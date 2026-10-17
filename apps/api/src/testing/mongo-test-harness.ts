/**
 * Real-MongoDB harness for repository, route and process tests.
 *
 * Integration tests run against a real `mongod`, never a mocked model or driver
 * (`constitution.md` → Testing Discipline). The harness starts a throwaway server with
 * `mongodb-memory-server` and connects the API's own `MongoConnection` singleton to it, so tests
 * exercise the production connection path rather than a test-only one.
 *
 * One harness per spec file: `MongoConnection` is a process-wide singleton, and Vitest gives each
 * spec file its own module graph, so files never share a connection.
 *
 * Test-only: excluded from the build (`tsconfig.build.json`).
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

import { MongoConnection } from '../core/db/mongo-connection.js';

export interface MongoTestHarnessOptions {
  /**
   * Open the connection before `start()` resolves. Default `true`; pass `false` to test
   * behaviour before the connection opens.
   */
  readonly connect?: boolean;
  /** How long a query waits for a reachable server. Short, so a "DB down" test fails fast. */
  readonly serverSelectionTimeoutMs?: number;
}

/** Default selection timeout: well below Vitest's test timeout, long enough for a cold start. */
const DEFAULT_SERVER_SELECTION_TIMEOUT_MS = 2_000;

export class MongoTestHarness {
  /** `true` once `stopServer()` or `stop()` has stopped `mongod`. */
  private serverStopped = false;

  private constructor(
    private readonly server: MongoMemoryServer,
    /** The API's connection singleton, pointed at this harness's server. */
    readonly connection: MongoConnection,
  ) {}

  /** Starts a fresh `mongod` and (by default) connects the singleton to it. */
  static async start(options: MongoTestHarnessOptions = {}): Promise<MongoTestHarness> {
    const server = await MongoMemoryServer.create();
    const connection = MongoConnection.getInstance({
      uri: server.getUri(),
      serverSelectionTimeoutMs:
        options.serverSelectionTimeoutMs ?? DEFAULT_SERVER_SELECTION_TIMEOUT_MS,
      // Tests never hot-reload; keep the singleton out of the `globalThis` cache.
      cacheAcrossReloads: false,
    });

    const harness = new MongoTestHarness(server, connection);
    if (options.connect ?? true) await connection.connect();
    return harness;
  }

  /** Connection string of the throwaway server, for tests that spawn the API as a process. */
  get uri(): string {
    return this.server.getUri();
  }

  /**
   * Deletes every document in every collection, keeping the collections and their indexes, so
   * unique-index behaviour still holds in the next test. Call it in `afterEach` when tests in one
   * file must not see each other's data.
   */
  async reset(): Promise<void> {
    const db = this.connection.getConnection().db;
    if (!db) return;
    const collections = await db.collections();
    await Promise.all(collections.map((collection) => collection.deleteMany({})));
  }

  /**
   * Stops `mongod` while leaving the connection object in place, to simulate losing the
   * database after startup (e.g. `monorepo-foundation.IT02`).
   */
  async stopServer(): Promise<void> {
    if (this.serverStopped) return;
    this.serverStopped = true;
    await this.server.stop();
  }

  /** Disconnects and stops `mongod`. Safe to call more than once and after `stopServer()`. */
  async stop(): Promise<void> {
    await this.connection.disconnect();
    await this.stopServer();
  }
}
