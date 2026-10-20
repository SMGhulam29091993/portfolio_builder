/**
 * `section-engine.CT02` — shared contract suites for `IPortfolioRepository` and
 * `ISectionRepository`, run against the MongoDB repositories on a real `mongod` and against the
 * in-memory fakes (`constitution.md` → Liskov Substitution). AC2, AC3, AC9, AC15 (indexes), AC16
 * (scoping by portfolio).
 */
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  InMemoryPortfolioRepository,
  InMemorySectionRepository,
  MongoTestHarness,
} from '../../testing/index.js';
import type { IPortfolioRepository, ISectionRepository } from './portfolio.interface.js';
import { portfolioModel, sectionModel } from './portfolio.model.js';
import { PortfolioRepository } from './portfolio.repository.js';
import { SectionRepository } from './section.repository.js';

let mongo: MongoTestHarness;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  await portfolioModel(mongo.connection.getConnection()).init();
  await sectionModel(mongo.connection.getConnection()).init();
});

afterEach(async () => {
  await mongo.reset();
});

afterAll(async () => {
  await mongo.stop();
});

const userId = () => new Types.ObjectId().toString();

describe.each([
  { name: 'PortfolioRepository', create: (): IPortfolioRepository => new PortfolioRepository(mongo.connection) },
  { name: 'InMemoryPortfolioRepository', create: (): IPortfolioRepository => new InMemoryPortfolioRepository() },
])('section-engine.CT02 — portfolio repository contract — $name', (subject) => {
  it('creates at revision 1 and finds by user, id and slug', async () => {
    const repo = subject.create();
    const owner = userId();

    const created = await repo.create({ userId: owner, slug: 'ann', sectionOrder: ['about', 'work'] });

    expect(created).toMatchObject({ userId: owner, slug: 'ann', sectionOrder: ['about', 'work'], revision: 1 });
    await expect(repo.findByUserId(owner)).resolves.toEqual(created);
    await expect(repo.findById(created.id)).resolves.toEqual(created);
    await expect(repo.findBySlug('ann')).resolves.toEqual(created);
    await expect(repo.findByUserId(userId())).resolves.toBeNull();
    await expect(repo.findById('nope')).resolves.toBeNull();
  });

  it('section-engine.AC15 — one portfolio per user; one owner per slug', async () => {
    const repo = subject.create();
    const owner = userId();
    await repo.create({ userId: owner, slug: 'taken', sectionOrder: [] });

    await expect(repo.create({ userId: owner, slug: 'other', sectionOrder: [] })).rejects.toMatchObject({
      code: 'PORTFOLIO_EXISTS',
    });
    await expect(repo.create({ userId: userId(), slug: 'taken', sectionOrder: [] })).rejects.toMatchObject({
      code: 'SLUG_TAKEN',
    });
  });

  it('section-engine.AC9 — updateOrder() is conditional on the revision', async () => {
    const repo = subject.create();
    const created = await repo.create({ userId: userId(), slug: 'order', sectionOrder: ['a', 'b'] });

    const updated = await repo.updateOrder(created.id, 1, ['b', 'a']);

    expect(updated).toMatchObject({ sectionOrder: ['b', 'a'], revision: 2 });
    await expect(repo.updateOrder(created.id, 1, ['a', 'b'])).resolves.toBeNull();
    await expect(repo.findById(created.id)).resolves.toMatchObject({ sectionOrder: ['b', 'a'] });
  });

  it('section-engine.AC17 — updateSlug() is conditional and refuses a taken slug', async () => {
    const repo = subject.create();
    const mine = await repo.create({ userId: userId(), slug: 'mine', sectionOrder: [] });
    await repo.create({ userId: userId(), slug: 'theirs', sectionOrder: [] });

    await expect(repo.updateSlug(mine.id, 1, 'theirs')).rejects.toMatchObject({ code: 'SLUG_TAKEN' });
    await expect(repo.updateSlug(mine.id, 1, 'renamed')).resolves.toMatchObject({ slug: 'renamed', revision: 2 });
    await expect(repo.updateSlug(mine.id, 1, 'again')).resolves.toBeNull();
  });
});

describe.each([
  { name: 'SectionRepository', create: (): ISectionRepository => new SectionRepository(mongo.connection) },
  { name: 'InMemorySectionRepository', create: (): ISectionRepository => new InMemorySectionRepository() },
])('section-engine.CT02 — section repository contract — $name', (subject) => {
  const portfolioA = new Types.ObjectId().toString();
  const portfolioB = new Types.ObjectId().toString();

  it('creates at revision 1 and refuses a second document of the same type', async () => {
    const repo = subject.create();

    const created = await repo.create(portfolioA, { type: 'about', visible: true, data: { a: [1, {}] } });

    expect(created).toMatchObject({ portfolioId: portfolioA, type: 'about', visible: true, revision: 1, data: { a: [1, {}] } });
    await expect(repo.create(portfolioA, { type: 'about', visible: true, data: {} })).rejects.toMatchObject({
      code: 'SECTION_EXISTS',
    });
  });

  it('section-engine.AC16 — reads are scoped by portfolio', async () => {
    const repo = subject.create();
    await repo.create(portfolioA, { type: 'about', visible: true, data: { who: 'a' } });
    await repo.create(portfolioB, { type: 'about', visible: true, data: { who: 'b' } });

    const listed = await repo.listByPortfolio(portfolioA);

    expect(listed.map((section) => section.data)).toEqual([{ who: 'a' }]);
    await expect(repo.find(portfolioB, 'about')).resolves.toMatchObject({ data: { who: 'b' } });
    await expect(repo.find(portfolioA, 'work')).resolves.toBeNull();
  });

  it('section-engine.AC2, AC3 — update() is conditional on the revision and touches one section', async () => {
    const repo = subject.create();
    await repo.create(portfolioA, { type: 'about', visible: true, data: { v: 1 } });
    await repo.create(portfolioA, { type: 'work', visible: true, data: { v: 1 } });

    const updated = await repo.update(portfolioA, 'about', 1, { data: { v: 2 } });

    expect(updated).toMatchObject({ revision: 2, data: { v: 2 }, visible: true });
    await expect(repo.update(portfolioA, 'about', 1, { data: { v: 3 } })).resolves.toBeNull();
    await expect(repo.update(portfolioB, 'about', 2, { visible: false })).resolves.toBeNull();
    await expect(repo.find(portfolioA, 'work')).resolves.toMatchObject({ revision: 1 });
    await expect(repo.update(portfolioA, 'about', 2, { visible: false })).resolves.toMatchObject({
      revision: 3,
      visible: false,
      data: { v: 2 },
    });
  });

  it('section-engine.AC12 — createMissing() inserts only absent types and never overwrites', async () => {
    const repo = subject.create();
    await repo.create(portfolioA, { type: 'about', visible: false, data: { edited: true } });

    const created = await repo.createMissing(portfolioA, [
      { type: 'about', visible: true, data: { edited: false } },
      { type: 'work', visible: true, data: {} },
    ]);

    expect(created).toBe(1);
    await expect(repo.find(portfolioA, 'about')).resolves.toMatchObject({ visible: false, data: { edited: true } });
    await expect(repo.createMissing(portfolioA, [{ type: 'work', visible: true, data: {} }])).resolves.toBe(0);
    await expect(repo.createMissing(portfolioA, [])).resolves.toBe(0);
  });
});
