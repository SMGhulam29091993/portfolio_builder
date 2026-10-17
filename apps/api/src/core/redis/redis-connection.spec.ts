/**
 * Integration tests for `RedisConnection` against a real Redis server (ADR-0008;
 * `constitution.md` → Testing Discipline: never mock the driver). The harness claims a logical
 * database for this file without connecting the singleton, so each test drives the class itself.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { RecordingLogger, RedisTestHarness } from '../../testing/index.js';
import { RedisConnection, type RedisConnectionOptions } from './redis-connection.js';

/** A port nothing listens on, carrying a fake password that must never be logged. */
const UNREACHABLE_URL = 'redis://default:not-a-real-secret@127.0.0.1:1/0';

let harness: RedisTestHarness;
const opened: RedisConnection[] = [];

/** Options pointing at this file's claimed database; individual tests override fields. */
function optionsFor(overrides: Partial<RedisConnectionOptions> = {}): RedisConnectionOptions {
  return {
    url: harness.url,
    connectTimeoutMs: 2_000,
    cacheAcrossReloads: false,
    logger: new RecordingLogger(),
    ...overrides,
  };
}

/** Gets the singleton and remembers it so `afterEach` always releases it. */
function track(connection: RedisConnection): RedisConnection {
  opened.push(connection);
  return connection;
}

beforeAll(async () => {
  harness = await RedisTestHarness.start({ connect: false });
});

afterEach(async () => {
  await Promise.all(opened.splice(0).map((connection) => connection.disconnect()));
});

afterAll(async () => {
  await harness.stop();
});

describe('RedisConnection', () => {
  it('owner-auth.T01 — connects to a reachable server and serves commands on the selected database', async () => {
    const connection = track(RedisConnection.getInstance(optionsFor()));

    await connection.connect();

    expect(connection.isConnected()).toBe(true);
    await connection.getClient().set('probe', 'ok');
    // `harness.url` ends in the claimed database, so the key lands there and nowhere else.
    await expect(connection.getClient().sendCommand(['CLIENT', 'INFO'])).resolves.toContain(
      `db=${String(harness.database)}`,
    );
  });

  it('returns the same instance until it is disconnected', async () => {
    const first = track(RedisConnection.getInstance(optionsFor()));
    expect(RedisConnection.getInstance(optionsFor())).toBe(first);

    await first.disconnect();

    const second = track(RedisConnection.getInstance(optionsFor()));
    expect(second).not.toBe(first);
  });

  it('shares one in-flight connect between concurrent callers', async () => {
    const connection = track(RedisConnection.getInstance(optionsFor()));

    await Promise.all([connection.connect(), connection.connect()]);

    expect(connection.isConnected()).toBe(true);
  });

  it('owner-auth.IT13 — rejects promptly when the server is unreachable, without logging the URL', async () => {
    const logger = new RecordingLogger();
    const connection = track(
      RedisConnection.getInstance(optionsFor({ url: UNREACHABLE_URL, logger })),
    );

    const started = Date.now();
    await expect(connection.connect()).rejects.toThrow();

    // Startup fails on the first refusal instead of entering the reconnect loop.
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(connection.isConnected()).toBe(false);
    expect(() => connection.getClient()).toThrow('Redis connection is not open');
    expect(JSON.stringify(logger.entries)).not.toContain('not-a-real-secret');
  });

  it('owner-auth.T01 — reconnects on its own after an established socket is dropped', async () => {
    const connection = track(RedisConnection.getInstance(optionsFor()));
    await connection.connect();
    const client = connection.getClient();
    const clientId = await client.clientId();

    // Kill exactly this client's socket from a second connection, as a server restart or a
    // network blip would; `CLIENT KILL ID` leaves every other test file's clients alone.
    const killer = client.duplicate();
    await killer.connect();
    await killer.sendCommand(['CLIENT', 'KILL', 'ID', String(clientId)]);
    await killer.close();

    await expect.poll(async () => client.ping(), { timeout: 5_000 }).toBe('PONG');
    expect(connection.isConnected()).toBe(true);
    expect(await client.clientId()).not.toBe(clientId);
  });

  it('closes the client on disconnect and tolerates a second call', async () => {
    const connection = track(RedisConnection.getInstance(optionsFor()));
    await connection.connect();

    await connection.disconnect();
    await connection.disconnect();

    expect(connection.isConnected()).toBe(false);
    expect(() => connection.getClient()).toThrow('Redis connection is not open');
  });

  it('tolerates disconnect before any connect', async () => {
    const connection = track(RedisConnection.getInstance(optionsFor()));

    await expect(connection.disconnect()).resolves.toBeUndefined();
  });

  it('caches the instance on globalThis only when asked to (hot reload)', async () => {
    const cached = track(RedisConnection.getInstance(optionsFor({ cacheAcrossReloads: true })));
    const cacheKey = Symbol.for('portfolio-builder.api.redis-connection');

    expect((globalThis as Record<symbol, unknown>)[cacheKey]).toBe(cached);

    await cached.disconnect();

    expect((globalThis as Record<symbol, unknown>)[cacheKey]).toBeUndefined();
  });
});
