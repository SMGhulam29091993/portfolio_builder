/**
 * `design-library.CT01` — shared contract suite for `ILayoutLibraryRepository` and
 * `IPresetRepository`, run against the MongoDB repositories and the in-memory fakes the services
 * are tested with (`constitution.md` → Liskov Substitution).
 */
import { DEFAULT_DESIGN, LAYOUT_BLOCKS, type CustomLayout } from '@portfolio/design-tokens';
import { Types } from 'mongoose';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { InMemoryLayoutLibrary, InMemoryPresetRepository, MongoTestHarness } from '../../testing/index.js';
import type { ILayoutLibraryRepository, IPresetRepository } from './design.interface.js';
import { LayoutLibraryRepository, PresetRepository } from './layout-library.repository.js';

let mongo: MongoTestHarness;
beforeAll(async () => {
  mongo = await MongoTestHarness.start();
});
afterEach(async () => {
  await mongo.reset();
});
afterAll(async () => {
  await mongo.stop();
});

const portfolioId = new Types.ObjectId().toString();
const otherPortfolioId = new Types.ObjectId().toString();

function stacked(section: CustomLayout['section']): CustomLayout {
  const children = Object.entries(LAYOUT_BLOCKS[section]).map(([block, styles]) => ({ kind: 'block' as const, block, style: styles[0] ?? null }));
  return { section, align: 'start', body: { kind: 'stack', gap: 'md', columns: null, children } };
}

const subjects: readonly { name: string; layouts: () => ILayoutLibraryRepository; presets: () => IPresetRepository }[] = [
  { name: 'MongoDB', layouts: () => new LayoutLibraryRepository(mongo.connection), presets: () => new PresetRepository(mongo.connection) },
  { name: 'in-memory', layouts: () => new InMemoryLayoutLibrary(), presets: () => new InMemoryPresetRepository() },
];

describe.each(subjects)('design-library.CT01 — library repositories — $name', (subject) => {
  let layouts: ILayoutLibraryRepository;
  let presets: IPresetRepository;
  beforeEach(() => {
    layouts = subject.layouts();
    presets = subject.presets();
  });

  it('stores layouts with their section, finds them per portfolio, lists newest first, counts and deletes', async () => {
    const [work] = await layouts.insertMany(portfolioId, [{ name: 'Work grid', layout: stacked('work'), source: 'ai' }], new Date('2026-10-21T10:00:00Z'));
    const [about] = await layouts.insertMany(portfolioId, [{ name: 'About', layout: stacked('about'), source: 'preset' }], new Date('2026-10-21T11:00:00Z'));
    expect(work).toMatchObject({ portfolioId, section: 'work', name: 'Work grid', source: 'ai', layout: stacked('work') });
    expect(await layouts.findLayout(portfolioId, work?.id ?? '')).toEqual(work);
    expect(await layouts.findLayout(otherPortfolioId, work?.id ?? '')).toBeNull();
    expect(await layouts.findLayout(portfolioId, 'not-an-id')).toBeNull();
    expect((await layouts.list(portfolioId)).map((row) => row.id)).toEqual([about?.id, work?.id]);
    expect(await layouts.count(portfolioId)).toBe(2);
    expect(await layouts.count(otherPortfolioId)).toBe(0);
    expect(await layouts.delete(otherPortfolioId, work?.id ?? '')).toBe(false);
    expect(await layouts.delete(portfolioId, work?.id ?? '')).toBe(true);
    expect(await layouts.delete(portfolioId, work?.id ?? '')).toBe(false);
    expect(await layouts.insertMany(portfolioId, [], new Date())).toEqual([]);
  });

  it('stores presets, finds, lists, counts, deletes, and knows which layouts they use', async () => {
    const ref = `custom:${new Types.ObjectId().toString()}`;
    const design = { ...DEFAULT_DESIGN, layout: { ...DEFAULT_DESIGN.layout, work: ref } };
    const preset = await presets.insert(portfolioId, { name: 'Calm', design }, new Date('2026-10-21T10:00:00Z'));
    expect(preset).toMatchObject({ portfolioId, name: 'Calm', design });
    expect(await presets.find(portfolioId, preset.id)).toEqual(preset);
    expect(await presets.find(otherPortfolioId, preset.id)).toBeNull();
    expect(await presets.list(portfolioId)).toEqual([preset]);
    expect(await presets.count(portfolioId)).toBe(1);
    expect(await presets.usesLayout(portfolioId, ref)).toBe(true);
    expect(await presets.usesLayout(portfolioId, `custom:${new Types.ObjectId().toString()}`)).toBe(false);
    expect(await presets.usesLayout(otherPortfolioId, ref)).toBe(false);
    expect(await presets.delete(portfolioId, preset.id)).toBe(true);
    expect(await presets.delete(portfolioId, preset.id)).toBe(false);
    expect(await presets.find(portfolioId, 'not-an-id')).toBeNull();
  });
});
