/**
 * Shared contract suite for `IDatabaseConnection` (`constitution.md` → Liskov Substitution:
 * every interface with more than one implementation has one suite that runs against each).
 *
 * `ApplicationLifecycle` treats every datastore the same way — connect in order, fail startup
 * on a rejection, close in reverse — so `MongoConnection` and `RedisConnection` must behave
 * identically through the port. Both run against real servers (`mongodb-memory-server` and the
 * compose / CI Redis), never a mocked driver. Class-specific behaviour (singleton caching,
 * reconnecting) stays in each class's own spec.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { RecordingLogger, RedisTestHarness } from '../../testing/index.js';
import { RedisConnection } from '../redis/redis-connection.js';
import type { IDatabaseConnection } from './database-connection.interface.js';
import { MongoConnection } from './mongo-connection.js';

/** How each implementation is built against a reachable or an unreachable server. */
interface ContractSubject {
  readonly name: string;
  readonly reachable: () => IDatabaseConnection;
  readonly unreachable: () => IDatabaseConnection;
}

let mongo: MongoMemoryServer;
let redis: RedisTestHarness;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  redis = await RedisTestHarness.start({ connect: false });
});

afterAll(async () => {
  await mongo.stop();
  await redis.stop();
});

const subjects: readonly ContractSubject[] = [
  {
    name: 'MongoConnection',
    reachable: () =>
      MongoConnection.getInstance({
        uri: mongo.getUri(),
        serverSelectionTimeoutMs: 2_000,
        cacheAcrossReloads: false,
      }),
    unreachable: () =>
      MongoConnection.getInstance({
        uri: 'mongodb://127.0.0.1:1/contract',
        serverSelectionTimeoutMs: 300,
        cacheAcrossReloads: false,
      }),
  },
  {
    name: 'RedisConnection',
    reachable: () =>
      RedisConnection.getInstance({
        url: redis.url,
        connectTimeoutMs: 2_000,
        cacheAcrossReloads: false,
        logger: new RecordingLogger(),
      }),
    unreachable: () =>
      RedisConnection.getInstance({
        url: 'redis://127.0.0.1:1/0',
        connectTimeoutMs: 300,
        cacheAcrossReloads: false,
        logger: new RecordingLogger(),
      }),
  },
];

describe.each(subjects)('IDatabaseConnection contract — $name', (subject) => {
  const opened: IDatabaseConnection[] = [];

  /** Builds through the subject and remembers the instance so `afterEach` releases it. */
  function track(connection: IDatabaseConnection): IDatabaseConnection {
    opened.push(connection);
    return connection;
  }

  afterEach(async () => {
    await Promise.all(opened.splice(0).map((connection) => connection.disconnect()));
  });

  it('is not connected before connect()', () => {
    expect(track(subject.reachable()).isConnected()).toBe(false);
  });

  it('resolves connect() only once the server answered', async () => {
    const connection = track(subject.reachable());

    await connection.connect();

    expect(connection.isConnected()).toBe(true);
  });

  it('opens once when connect() is called concurrently and again after it succeeded', async () => {
    const connection = track(subject.reachable());

    await Promise.all([connection.connect(), connection.connect()]);
    await connection.connect();

    expect(connection.isConnected()).toBe(true);
  });

  it('rejects connect() when the server is unreachable and stays disconnected', async () => {
    const connection = track(subject.unreachable());

    await expect(connection.connect()).rejects.toThrow();

    expect(connection.isConnected()).toBe(false);
  });

  it('disconnects, and tolerates a second disconnect', async () => {
    const connection = track(subject.reachable());
    await connection.connect();

    await connection.disconnect();
    await connection.disconnect();

    expect(connection.isConnected()).toBe(false);
  });

  it('tolerates disconnect() before any connect()', async () => {
    await expect(track(subject.reachable()).disconnect()).resolves.toBeUndefined();
  });
});
