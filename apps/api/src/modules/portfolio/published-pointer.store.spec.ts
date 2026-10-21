/**
 * `PublishedPointerStore` against real MongoDB (`publish-pipeline.T02`; AC3, AC13, AC16): the
 * compare-and-swap is the publish's commit, and it never touches the portfolio's `revision`.
 */
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MongoTestHarness } from '../../testing/index.js';
import { portfolioModel } from './portfolio.model.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { PublishedPointerStore } from './published-pointer.store.js';

let mongo: MongoTestHarness;
let pointers: PublishedPointerStore;
let portfolios: PortfolioRepository;

const at = new Date(Date.UTC(2026, 9, 21));
const first = { snapshotId: new Types.ObjectId().toString(), version: 1, publishedAt: at };
const second = { snapshotId: new Types.ObjectId().toString(), version: 2, publishedAt: at };

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  await portfolioModel(mongo.connection.getConnection()).init();
  pointers = new PublishedPointerStore(mongo.connection);
  portfolios = new PortfolioRepository(mongo.connection);
});
afterEach(async () => {
  await mongo.reset();
});
afterAll(async () => {
  await mongo.stop();
});

async function newPortfolio(slug = 'ada') {
  return portfolios.create({ userId: new Types.ObjectId().toString(), slug, sectionOrder: ['about'] });
}

describe('PublishedPointerStore', () => {
  it('reads no pointer before the first publish, by id and by slug', async () => {
    const portfolio = await newPortfolio();
    expect(await pointers.read(portfolio.id)).toEqual({ portfolioId: portfolio.id, slug: 'ada', pointer: null });
    expect(await pointers.findBySlug('ada')).toEqual({ portfolioId: portfolio.id, slug: 'ada', pointer: null });
    expect(await pointers.findBySlug('nobody')).toBeNull();
    expect(await pointers.read('not-an-id')).toBeNull();
    expect(await pointers.read(new Types.ObjectId().toString())).toBeNull();
  });

  it('switches only while the expected snapshot is still live; the revision is untouched', async () => {
    const portfolio = await newPortfolio();
    expect(await pointers.switchTo(portfolio.id, null, first)).toBe(true);
    expect((await pointers.read(portfolio.id))?.pointer).toEqual(first);

    // publish-pipeline.AC16 — a racing writer that still expects "nothing published" loses.
    expect(await pointers.switchTo(portfolio.id, null, second)).toBe(false);
    expect(await pointers.switchTo(portfolio.id, second.snapshotId, second)).toBe(false);
    expect(await pointers.switchTo(portfolio.id, first.snapshotId, second)).toBe(true);
    expect((await pointers.findBySlug('ada'))?.pointer).toEqual(second);

    expect((await portfolios.findById(portfolio.id))?.revision).toBe(portfolio.revision);
    await newPortfolio('bea');
    expect((await pointers.listPublished()).map((state) => state.slug)).toEqual(['ada']);
    expect(await pointers.switchTo('not-an-id', null, first)).toBe(false);
  });
});
