/**
 * `SnapshotRepository` against real MongoDB (`publish-pipeline.T01`; AC14 / IT20, AC20).
 */
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MongoTestHarness } from '../../testing/index.js';
import type { NewSnapshot, PublishedContent } from './publishing.types.js';
import { snapshotModel } from './snapshot.model.js';
import { SnapshotRepository } from './snapshot.repository.js';

let mongo: MongoTestHarness;
let repository: SnapshotRepository;

const portfolioId = new Types.ObjectId().toString();
const otherPortfolioId = new Types.ObjectId().toString();
const userId = new Types.ObjectId().toString();

function content(assetIds: readonly string[] = []): PublishedContent {
  return {
    schemaVersion: 1,
    identity: {} as PublishedContent['identity'],
    sections: [{ type: 'hero', data: { empty: {} } }],
    design: { theme: {}, layout: {} },
    assets: assetIds.map((id) => ({ id, kind: 'resume', filename: 'cv.pdf', mime: 'application/pdf', sizeBytes: 1, sha256: 'a'.repeat(64) })),
  };
}

function snapshot(version: number, owner = portfolioId, assetIds: readonly string[] = []): NewSnapshot {
  return {
    portfolioId: owner,
    version,
    contentHash: String(version).padStart(64, '0'),
    content: content(assetIds),
    note: version === 1 ? 'first' : null,
    publishedAt: new Date(Date.UTC(2026, 9, 1, 0, version)),
    publishedBy: userId,
  };
}

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  await snapshotModel(mongo.connection.getConnection()).init();
  repository = new SnapshotRepository(mongo.connection);
});
afterEach(async () => {
  await mongo.reset();
});
afterAll(async () => {
  await mongo.stop();
});

describe('SnapshotRepository', () => {
  it('publish-pipeline.IT20 / AC14 — offers insert, reads, delivery update and the prune only', () => {
    const members = Object.getOwnPropertyNames(SnapshotRepository.prototype).filter((name) => name !== 'constructor' && name !== 'model');
    expect(members.sort()).toEqual(
      ['findById', 'findByVersion', 'insert', 'latestVersion', 'list', 'pruneOutsideWindow', 'referencesAsset', 'updateDelivery'].sort(),
    );
  });

  it('inserts with pending delivery; a taken version is SNAPSHOT_VERSION_TAKEN; empty objects survive', async () => {
    const stored = await repository.insert(snapshot(1));
    expect(stored).toMatchObject({ version: 1, note: 'first', delivery: { status: 'pending', at: null, attempts: 0 } });
    expect(stored.content.sections[0]?.data).toEqual({ empty: {} });
    await expect(repository.insert(snapshot(1))).rejects.toMatchObject({ code: 'SNAPSHOT_VERSION_TAKEN', status: 409 });
    // Versions are per portfolio.
    await expect(repository.insert(snapshot(1, otherPortfolioId))).resolves.toMatchObject({ version: 1 });
  });

  it('reads the latest version, by id and by version, scoped to the portfolio', async () => {
    expect(await repository.latestVersion(portfolioId)).toBe(0);
    const first = await repository.insert(snapshot(1));
    await repository.insert(snapshot(2));
    expect(await repository.latestVersion(portfolioId)).toBe(2);
    expect((await repository.findById(portfolioId, first.id))?.version).toBe(1);
    expect(await repository.findById(otherPortfolioId, first.id)).toBeNull();
    expect((await repository.findByVersion(portfolioId, 2))?.version).toBe(2);
    expect(await repository.findByVersion(portfolioId, 9)).toBeNull();
    expect(await repository.findById('not-an-id', first.id)).toBeNull();
    expect(await repository.latestVersion('not-an-id')).toBe(0);
  });

  it('lists newest first without content, continuing below a version', async () => {
    for (const version of [1, 2, 3]) await repository.insert(snapshot(version));
    const page = await repository.list(portfolioId, 2);
    expect(page.map((row) => row.version)).toEqual([3, 2]);
    expect(page[0]).not.toHaveProperty('content');
    expect((await repository.list(portfolioId, 2, 2)).map((row) => row.version)).toEqual([1]);
    expect(await repository.list('not-an-id', 2)).toEqual([]);
  });

  it('publish-pipeline.IT20 — updateDelivery changes delivery only, counting attempts', async () => {
    const stored = await repository.insert(snapshot(1));
    const at = new Date(Date.UTC(2026, 9, 2));
    expect(await repository.updateDelivery(portfolioId, stored.id, { status: 'failed', at })).toBe(true);
    expect(await repository.updateDelivery(portfolioId, stored.id, { status: 'ok', at })).toBe(true);
    const after = await repository.findById(portfolioId, stored.id);
    expect(after?.delivery).toEqual({ status: 'ok', at, attempts: 2 });
    expect(after?.content).toEqual(stored.content);
    expect(after?.contentHash).toBe(stored.contentHash);
    expect(after?.version).toBe(1);
    expect(await repository.updateDelivery(otherPortfolioId, stored.id, { status: 'ok', at })).toBe(false);
  });

  it('publish-pipeline.AC18 — reports assets listed by any of the portfolio’s snapshots', async () => {
    await repository.insert(snapshot(1, portfolioId, ['asset-1']));
    expect(await repository.referencesAsset(portfolioId, 'asset-1')).toBe(true);
    expect(await repository.referencesAsset(portfolioId, 'asset-2')).toBe(false);
    expect(await repository.referencesAsset(otherPortfolioId, 'asset-1')).toBe(false);
  });

  describe('publish-pipeline.AC20 — retention', () => {
    it('deletes versions older than the newest `keep`, never the live one or another portfolio’s', async () => {
      const stored = [];
      for (let version = 1; version <= 5; version += 1) stored.push(await repository.insert(snapshot(version)));
      await repository.insert(snapshot(1, otherPortfolioId));
      const live = stored[4];
      if (!live) throw new Error('fixture');
      expect(await repository.pruneOutsideWindow(portfolioId, 3, live.id)).toBe(2);
      expect((await repository.list(portfolioId, 10)).map((row) => row.version)).toEqual([5, 4, 3]);
      expect(await repository.latestVersion(otherPortfolioId)).toBe(1);
    });

    it('keeps the live snapshot when it falls outside the window', async () => {
      const stored = [];
      for (let version = 1; version <= 4; version += 1) stored.push(await repository.insert(snapshot(version)));
      const live = stored[0];
      if (!live) throw new Error('fixture');
      expect(await repository.pruneOutsideWindow(portfolioId, 2, live.id)).toBe(1);
      expect((await repository.list(portfolioId, 10)).map((row) => row.version)).toEqual([4, 3, 1]);
    });

    it('deletes nothing inside the window or with bad ids', async () => {
      const live = await repository.insert(snapshot(1));
      expect(await repository.pruneOutsideWindow(portfolioId, 20, live.id)).toBe(0);
      expect(await repository.pruneOutsideWindow('bad', 1, live.id)).toBe(0);
    });
  });
});
