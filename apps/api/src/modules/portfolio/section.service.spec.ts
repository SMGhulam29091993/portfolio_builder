/**
 * `SectionService` with fakes (`section-engine.UT01`–`UT08`, `UT16`; AC1–AC9, AC18). The
 * engine is tested with test-only definitions, independent of the six real section types.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/index.js';
import {
  FakeHeroDefinition,
  FakeSectionDefinition,
  InMemoryPortfolioRepository,
  InMemorySectionRepository,
} from '../../testing/index.js';
import type { IIdGenerator } from './portfolio.interface.js';
import type { Portfolio } from './portfolio.types.js';
import { SectionRegistry } from './section.registry.js';
import { SectionService } from './section.service.js';

class CountingIds implements IIdGenerator {
  private count = 0;
  next(): string {
    this.count += 1;
    return `id-${String(this.count)}`;
  }
}

let portfolios: InMemoryPortfolioRepository;
let sections: InMemorySectionRepository;
let service: SectionService;
let portfolio: Portfolio;

beforeEach(async () => {
  portfolios = new InMemoryPortfolioRepository();
  sections = new InMemorySectionRepository();
  service = new SectionService(
    portfolios,
    sections,
    new SectionRegistry([new FakeHeroDefinition(), new FakeSectionDefinition('about'), new FakeSectionDefinition('work')]),
    new CountingIds(),
  );
  portfolio = await portfolios.create({ userId: 'u1', slug: 'mine', sectionOrder: ['about', 'work'] });
  await sections.createMissing(portfolio.id, [
    { type: 'hero', visible: true, data: { title: 'Hi' } },
    { type: 'about', visible: true, data: { heading: 'About', items: [], tags: [] } },
  ]);
});

const VALID = { heading: 'New heading', items: [{ title: 'One' }], tags: ['a'] };

async function errorOf(promise: Promise<unknown>): Promise<unknown> {
  return promise.catch((error: unknown) => error);
}

describe('readDraft', () => {
  it('section-engine.AC1 / UT16 — every registered type; a missing one as hidden defaults at revision 0', async () => {
    const draft = await service.readDraft(portfolio.id);

    expect(draft.portfolio).toEqual({ id: portfolio.id, slug: 'mine', revision: 1, sectionOrder: ['about', 'work'] });
    expect(draft.sections.map((section) => [section.type, section.revision, section.visible])).toEqual([
      ['hero', 1, true],
      ['about', 1, true],
      ['work', 0, false],
    ]);
    expect(draft.sections[2]?.data).toEqual(new FakeSectionDefinition().defaults());
    expect(draft.sections[2]?.updatedAt).toBeUndefined();
  });

  it('lists the type flags', () => {
    expect(service.listTypes()).toEqual([
      { type: 'hero', label: 'Hero', orderable: false, hideable: false, inNav: false },
      { type: 'about', label: 'Fake about', orderable: true, hideable: true, inNav: true },
      { type: 'work', label: 'Fake work', orderable: true, hideable: true, inNav: true },
    ]);
  });
});

describe('updateSection', () => {
  it('section-engine.UT01 / AC2 — stores the cleaned payload and increments only that revision', async () => {
    const section = await service.updateSection(portfolio.id, 'about', 1, {
      ...VALID,
      heading: '<b>New</b> heading',
    });

    expect(section).toMatchObject({ type: 'about', revision: 2, data: { heading: 'New heading' } });
    await expect(sections.find(portfolio.id, 'hero')).resolves.toMatchObject({ revision: 1 });
  });

  it('section-engine.UT02 / AC3 — a stale revision is REVISION_CONFLICT with the current one; nothing written', async () => {
    await service.updateSection(portfolio.id, 'about', 1, VALID);

    const error = await errorOf(service.updateSection(portfolio.id, 'about', 1, { ...VALID, heading: 'Lost' }));

    expect(error).toBeInstanceOf(ConflictError);
    expect(error).toMatchObject({ code: 'REVISION_CONFLICT', details: { currentRevision: 2 } });
    await expect(sections.find(portfolio.id, 'about')).resolves.toMatchObject({ data: { heading: 'New heading' } });
  });

  it('section-engine.UT03 / AC4 — every failing path, relative to data; nothing written', async () => {
    const error = await errorOf(
      service.updateSection(portfolio.id, 'about', 1, { heading: '', items: [{ title: 'x'.repeat(21) }], tags: 'no' }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    const paths = (error as ValidationError).details.errors as { path: string }[];
    expect(paths.map((issue) => issue.path).sort()).toEqual(['heading', 'items.0.title', 'tags']);
    await expect(sections.find(portfolio.id, 'about')).resolves.toMatchObject({ revision: 1 });
  });

  it('section-engine.UT04 / AC5 — an unregistered type is NOT_FOUND', async () => {
    await expect(service.updateSection(portfolio.id, 'nope', 1, VALID)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.setVisibility(portfolio.id, 'nope', 1, false)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('section-engine.UT05 / AC6 — tags and control characters are stripped; an emptied field fails', async () => {
    const section = await service.updateSection(portfolio.id, 'about', 1, { ...VALID, heading: 'Hi\u0007 <i>there</i>' });

    expect(section.data).toMatchObject({ heading: 'Hi there' });
    await expect(service.updateSection(portfolio.id, 'about', 2, { ...VALID, heading: '<br>' })).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('section-engine.UT06 / AC7 — assigns missing ids, keeps given ones, refuses duplicates', async () => {
    const section = await service.updateSection(portfolio.id, 'about', 1, {
      ...VALID,
      items: [{ title: 'A' }, { id: 'kept', title: 'B' }],
    });

    expect((section.data as { items: unknown[] }).items).toEqual([
      { id: 'id-1', title: 'A' },
      { id: 'kept', title: 'B' },
    ]);
    const error = await errorOf(
      service.updateSection(portfolio.id, 'about', 2, { ...VALID, items: [{ id: 'x', title: 'A' }, { id: 'x', title: 'B' }] }),
    );
    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details.errors).toEqual([{ path: 'items.1.id', message: 'Two items share this id' }]);
  });

  it('section-engine.AC18 — revision 0 creates a missing section, hidden; a second create conflicts', async () => {
    const created = await service.updateSection(portfolio.id, 'work', 0, VALID);

    expect(created).toMatchObject({ type: 'work', revision: 1, visible: false });
    await expect(service.updateSection(portfolio.id, 'work', 0, VALID)).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
      details: { currentRevision: 1 },
    });
  });

  it('strips unknown keys (spec → Edge Cases)', async () => {
    const section = await service.updateSection(portfolio.id, 'about', 1, { ...VALID, sneaky: true });

    expect(section.data).not.toHaveProperty('sneaky');
  });
});

describe('setVisibility', () => {
  it('section-engine.AC8 — hides and shows with data intact', async () => {
    const hidden = await service.setVisibility(portfolio.id, 'about', 1, false);
    const shown = await service.setVisibility(portfolio.id, 'about', 2, true);

    expect(hidden).toMatchObject({ visible: false, revision: 2 });
    expect(shown).toMatchObject({ visible: true, revision: 3, data: { heading: 'About' } });
  });

  it('section-engine.UT07 / AC8 — hero is SECTION_NOT_HIDEABLE', async () => {
    await expect(service.setVisibility(portfolio.id, 'hero', 1, false)).rejects.toMatchObject({
      code: 'SECTION_NOT_HIDEABLE',
    });
  });

  it('revision 0 creates a missing section with its defaults and the requested visibility', async () => {
    await expect(service.setVisibility(portfolio.id, 'work', 0, true)).resolves.toMatchObject({
      visible: true,
      revision: 1,
      data: new FakeSectionDefinition().defaults(),
    });
  });
});

describe('reorder', () => {
  it('section-engine.AC9 — replaces the order and increments the portfolio revision', async () => {
    await expect(service.reorder(portfolio.id, 1, ['work', 'about'])).resolves.toMatchObject({
      sectionOrder: ['work', 'about'],
      revision: 2,
    });
  });

  it.each([
    ['missing a type', ['about']],
    ['a duplicate', ['about', 'about', 'work']],
    ['hero', ['hero', 'about', 'work']],
    ['an unknown type', ['about', 'work', 'blog']],
    ['empty', []],
  ])('section-engine.UT08 — refuses an order with %s', async (_case, order) => {
    await expect(service.reorder(portfolio.id, 1, order)).rejects.toBeInstanceOf(ValidationError);
  });

  it('a stale revision is REVISION_CONFLICT with the current one', async () => {
    await service.reorder(portfolio.id, 1, ['work', 'about']);

    await expect(service.reorder(portfolio.id, 1, ['about', 'work'])).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
      details: { currentRevision: 2 },
    });
  });
});
