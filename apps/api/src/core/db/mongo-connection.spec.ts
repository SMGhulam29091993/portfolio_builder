/**
 * Integration tests for `MongoConnection` against a real `mongod`
 * (`constitution.md` → Testing Discipline: never mock the driver).
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MongoConnection, type MongoConnectionOptions } from './mongo-connection.js';

/** A port nothing listens on, so connecting must fail. */
const UNREACHABLE_URI = 'mongodb://127.0.0.1:1/portfolio';

let server: MongoMemoryServer;
const opened: MongoConnection[] = [];

/** Options pointing at the in-memory server; individual tests override fields. */
function optionsFor(overrides: Partial<MongoConnectionOptions> = {}): MongoConnectionOptions {
  return {
    uri: server.getUri(),
    serverSelectionTimeoutMs: 2_000,
    cacheAcrossReloads: false,
    ...overrides,
  };
}

/** Gets the singleton and remembers it so `afterEach` always releases it. */
function track(connection: MongoConnection): MongoConnection {
  opened.push(connection);
  return connection;
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
});

afterEach(async () => {
  await Promise.all(opened.splice(0).map((connection) => connection.disconnect()));
});

afterAll(async () => {
  await server.stop();
});

describe('MongoConnection', () => {
  it('connects to a reachable server and reports it', async () => {
    const connection = track(MongoConnection.getInstance(optionsFor()));

    await connection.connect();

    expect(connection.isConnected()).toBe(true);
  });

  it('returns the same instance until it is disconnected', async () => {
    const first = track(MongoConnection.getInstance(optionsFor()));
    expect(MongoConnection.getInstance(optionsFor())).toBe(first);

    await first.disconnect();

    const second = track(MongoConnection.getInstance(optionsFor()));
    expect(second).not.toBe(first);
  });

  it('shares one in-flight connect between concurrent callers', async () => {
    const connection = track(MongoConnection.getInstance(optionsFor()));

    await Promise.all([connection.connect(), connection.connect()]);

    expect(connection.isConnected()).toBe(true);
  });

  it('rejects when the server is unreachable (monorepo-foundation.AC3)', async () => {
    const connection = track(
      MongoConnection.getInstance(optionsFor({ uri: UNREACHABLE_URI, serverSelectionTimeoutMs: 300 })),
    );

    await expect(connection.connect()).rejects.toThrow();
    expect(connection.isConnected()).toBe(false);
  });

  it('closes the connection on disconnect and tolerates a second call', async () => {
    const connection = track(MongoConnection.getInstance(optionsFor()));
    await connection.connect();

    await connection.disconnect();
    await connection.disconnect();

    expect(connection.isConnected()).toBe(false);
  });

  it('hands out the open connection only between connect and disconnect', async () => {
    const connection = track(MongoConnection.getInstance(optionsFor()));
    expect(() => connection.getConnection()).toThrow('not open');

    await connection.connect();
    const open = connection.getConnection();
    await expect(open.db?.admin().ping()).resolves.toEqual(expect.objectContaining({ ok: 1 }));

    await connection.disconnect();
    expect(() => connection.getConnection()).toThrow('not open');
  });

  describe('hot-reload cache', () => {
    const cacheKey = Symbol.for('portfolio-builder.api.mongo-connection');
    const globalCache = globalThis as Record<symbol, unknown>;

    it('is kept on globalThis outside production', () => {
      const connection = track(MongoConnection.getInstance(optionsFor({ cacheAcrossReloads: true })));

      expect(globalCache[cacheKey]).toBe(connection);
    });

    it('is skipped in production', () => {
      track(MongoConnection.getInstance(optionsFor({ cacheAcrossReloads: false })));

      expect(globalCache[cacheKey]).toBeUndefined();
    });
  });
});
