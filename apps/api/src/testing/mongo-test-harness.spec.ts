/**
 * The harness itself runs against a real `mongod`: it is what every integration test relies on.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { MongoTestHarness } from './mongo-test-harness.js';

describe('MongoTestHarness', () => {
  let harness: MongoTestHarness;

  beforeAll(async () => {
    harness = await MongoTestHarness.start();
  });

  afterAll(async () => {
    await harness.stop();
  });

  it('monorepo-foundation.IT16 — connects the API connection singleton to a throwaway mongod', async () => {
    expect(harness.uri).toMatch(/^mongodb:\/\/127\.0\.0\.1:\d+\//);
    expect(harness.connection.isConnected()).toBe(true);

    const db = harness.connection.getConnection().db;
    await expect(db?.admin().ping()).resolves.toEqual({ ok: 1 });
  });

  it('monorepo-foundation.IT16 — reset() empties every collection but keeps its indexes', async () => {
    const db = harness.connection.getConnection().db;
    if (!db) throw new Error('expected an open database');
    const things = db.collection('things');
    await things.createIndex({ slug: 1 }, { unique: true });
    await things.insertMany([{ slug: 'a' }, { slug: 'b' }]);
    await db.collection('others').insertOne({ n: 1 });

    await harness.reset();

    await expect(things.countDocuments()).resolves.toBe(0);
    await expect(db.collection('others').countDocuments()).resolves.toBe(0);
    const indexNames = (await things.indexes()).map((index) => index.name);
    expect(indexNames).toContain('slug_1');
  });
});

describe('MongoTestHarness without connecting', () => {
  it('leaves the connection closed when asked, and stop() is safe after stopServer()', async () => {
    const harness = await MongoTestHarness.start({ connect: false });
    try {
      expect(harness.connection.isConnected()).toBe(false);
      await harness.stopServer();
    } finally {
      await harness.stop();
    }
  });
});
