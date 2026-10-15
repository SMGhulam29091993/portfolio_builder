/**
 * Repository tests hit a real `mongod` (`constitution.md` → Per-layer convention).
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MongoConnection } from '../../core/db/mongo-connection.js';
import { HealthRepository } from './health.repository.js';

let server: MongoMemoryServer;
let connection: MongoConnection;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  connection = MongoConnection.getInstance({
    uri: server.getUri(),
    serverSelectionTimeoutMs: 2_000,
    cacheAcrossReloads: false,
  });
});

afterAll(async () => {
  await connection.disconnect();
  await server.stop();
});

describe('HealthRepository', () => {
  it('rejects while the connection is not open', async () => {
    await expect(new HealthRepository(connection).ping()).rejects.toThrow('not open');
  });

  it('resolves when MongoDB answers the ping', async () => {
    await connection.connect();

    await expect(new HealthRepository(connection).ping()).resolves.toBeUndefined();
  });
});
