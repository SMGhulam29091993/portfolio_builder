/**
 * Repository tests hit a real `mongod` (`constitution.md` → Per-layer convention).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MongoTestHarness } from '../../testing/index.js';
import { HealthRepository } from './health.repository.js';

let mongo: MongoTestHarness;

beforeAll(async () => {
  // Not connected yet: the first case checks behaviour before the connection opens.
  mongo = await MongoTestHarness.start({ connect: false });
});

afterAll(async () => {
  await mongo.stop();
});

describe('HealthRepository', () => {
  it('rejects while the connection is not open', async () => {
    await expect(new HealthRepository(mongo.connection).ping()).rejects.toThrow('not open');
  });

  it('resolves when MongoDB answers the ping', async () => {
    await mongo.connection.connect();

    await expect(new HealthRepository(mongo.connection).ping()).resolves.toBeUndefined();
  });
});
