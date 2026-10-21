/**
 * Real-Redis harness for Redis-backed store, route and process tests (ADR-0008).
 *
 * Redis-backed stores are tested against a real Redis server, never a mocked client
 * (`constitution.md` → Testing Discipline). Unlike MongoDB there is no in-memory server to
 * download, so the harness uses the Redis that `docker-compose.dev.yml` runs locally and that
 * CI runs as a service container, both on `127.0.0.1:6379`.
 *
 * Isolation: Vitest runs spec files in parallel against that one server, so each harness claims
 * a logical database of its own (1-14) with a leased key in database 0, and empties it on
 * start, on `reset()` and on `stop()`. Database 0 stays for `pnpm dev` and database 15 for the
 * E2E harness (`apps/web/e2e/start-api.ts`). A claim expires on its own if a test run is killed
 * before `stop()`.
 *
 * One harness per spec file, for the same reason as `MongoTestHarness`: `RedisConnection` is a
 * process-wide singleton. Test-only: excluded from the build (`tsconfig.build.json`).
 */
import { randomUUID } from 'node:crypto';
import { createClient } from '@redis/client';

import { RedisConnection } from '../core/redis/redis-connection.js';
import type { RedisClient } from '../core/redis/redis-client-provider.interface.js';
import { RecordingLogger } from './recording-logger.js';

/**
 * The test Redis server. A fixed address rather than an environment variable: only
 * `config/env.ts` reads the environment, and the compose file and CI both publish here.
 */
const TEST_REDIS_ORIGIN = 'redis://127.0.0.1:6379';

/** Logical databases a harness may claim. 0 is development, 15 is E2E. */
const FIRST_CLAIMABLE_DB = 1;
const LAST_CLAIMABLE_DB = 14;

/** Prefix of the claim keys in database 0. */
const CLAIM_KEY_PREFIX = 'test-harness:claim:db:';

/** How long a claim lives without `stop()`: far beyond one spec file, short enough to self-heal. */
const CLAIM_LEASE_SEC = 600;

/** How long `start()` waits for a free database; below Vitest's 60 s hook timeout so this error wins. */
const CLAIM_WAIT_MS = 45_000;

/** Pause between claim attempts while every database is held. */
const CLAIM_RETRY_MS = 250;

/** Connect timeout for the harness's clients: a missing server must fail the file quickly. */
const CONNECT_TIMEOUT_MS = 2_000;

export interface RedisTestHarnessOptions {
  /**
   * Connect the API's `RedisConnection` singleton before `start()` resolves. Default `true`;
   * pass `false` to test the connection class itself against the claimed database.
   */
  readonly connect?: boolean;
}

export class RedisTestHarness {
  /** `true` once `stop()` has run. */
  private stopped = false;

  private constructor(
    /** Client on database 0 holding the claim, and used to empty the claimed database. */
    private readonly control: RedisClient,
    /** The claimed logical database. */
    readonly database: number,
    /** Value of the claim key, so `stop()` only releases its own claim. */
    private readonly claimToken: string,
    /** The API's connection singleton, pointed at the claimed database. */
    readonly connection: RedisConnection,
    /** Receives the singleton's socket errors, for tests that assert on them. */
    readonly logger: RecordingLogger,
  ) {}

  /**
   * Claims a free logical database, empties it and (by default) connects the singleton to it.
   *
   * @throws {Error} With setup instructions when no Redis server answers, or when every
   *   claimable database is taken.
   */
  static async start(options: RedisTestHarnessOptions = {}): Promise<RedisTestHarness> {
    const control: RedisClient = createClient({
      url: TEST_REDIS_ORIGIN,
      socket: { connectTimeout: CONNECT_TIMEOUT_MS, reconnectStrategy: false },
    });
    // Reported through the rejected `connect()` below; the listener only stops a crash.
    control.on('error', () => undefined);

    try {
      await control.connect();
    } catch (error) {
      throw new Error(
        `No Redis server answers at ${TEST_REDIS_ORIGIN}. Start it with ` +
          '`docker compose -f docker-compose.dev.yml up -d redis` (ADR-0008).',
        { cause: error },
      );
    }

    const claimToken = randomUUID();
    const database = await RedisTestHarness.claimDatabase(control, claimToken);
    await control.select(database);
    await control.flushDb();

    const logger = new RecordingLogger();
    const connection = RedisConnection.getInstance({
      url: `${TEST_REDIS_ORIGIN}/${String(database)}`,
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      // Tests never hot-reload; keep the singleton out of the `globalThis` cache.
      cacheAcrossReloads: false,
      logger,
    });

    const harness = new RedisTestHarness(control, database, claimToken, connection, logger);
    if (options.connect ?? true) await connection.connect();
    return harness;
  }

  /** URL of the claimed database, for tests that spawn the API as a process. */
  get url(): string {
    return `${TEST_REDIS_ORIGIN}/${String(this.database)}`;
  }

  /** Deletes every key in the claimed database. Call it in `afterEach` to isolate tests. */
  async reset(): Promise<void> {
    await this.control.flushDb();
  }

  /** Disconnects the singleton, empties the database and releases the claim. Idempotent. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;

    await this.connection.disconnect();
    await this.control.flushDb();
    await this.control.select(0);
    // Release only a claim this harness still holds; an expired and re-claimed one is left alone.
    const key = `${CLAIM_KEY_PREFIX}${String(this.database)}`;
    if ((await this.control.get(key)) === this.claimToken) await this.control.del(key);
    await this.control.close();
  }

  /**
   * Takes the first free database with `SET NX`, so two harnesses can never share one. More spec
   * files use Redis than there are databases, so when all are held it waits for one to be
   * released (or a stale lease to expire), up to `CLAIM_WAIT_MS`, instead of failing at once.
   */
  private static async claimDatabase(control: RedisClient, token: string): Promise<number> {
    const deadline = Date.now() + CLAIM_WAIT_MS;
    do {
      for (let database = FIRST_CLAIMABLE_DB; database <= LAST_CLAIMABLE_DB; database += 1) {
        const claimed = await control.set(`${CLAIM_KEY_PREFIX}${String(database)}`, token, {
          condition: 'NX',
          expiration: { type: 'EX', value: CLAIM_LEASE_SEC },
        });
        if (claimed === 'OK') return database;
      }
      await new Promise((resolve) => setTimeout(resolve, CLAIM_RETRY_MS));
    } while (Date.now() < deadline);
    await control.close();
    throw new Error(
      `Every test Redis database (${String(FIRST_CLAIMABLE_DB)}-${String(LAST_CLAIMABLE_DB)}) is claimed.`,
    );
  }
}
