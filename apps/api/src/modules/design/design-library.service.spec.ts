/**
 * `DesignLibraryService` and `DesignService`'s library check with fakes (`design-library.T03`;
 * AC2, AC5, AC6, AC8 storage side).
 */
import { DEFAULT_DESIGN, LAYOUT_BLOCKS, type CustomLayout, type DesignSpec } from '@portfolio/design-tokens';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError } from '../../core/errors/index.js';
import { InMemoryLayoutLibrary, InMemoryPresetRepository, ManualClock } from '../../testing/index.js';
import { DesignLibraryService } from './design-library.service.js';
import type { IDesignRepository } from './design.interface.js';
import { DesignService } from './design.service.js';
import { LAYOUT_LIBRARY_MAX, PRESET_LIBRARY_MAX, type StoredDesign } from './design.types.js';
import { DesignValidator } from './design.validator.js';

class FakeDesigns implements IDesignRepository {
  readonly stored = new Map<string, StoredDesign>();
  find(portfolioId: string): Promise<StoredDesign | null> {
    return Promise.resolve(this.stored.get(portfolioId) ?? null);
  }
  // eslint-disable-next-line @typescript-eslint/require-await -- async so conflicts reject.
  async create(portfolioId: string, design: DesignSpec): Promise<StoredDesign> {
    if (this.stored.has(portfolioId)) throw new ConflictError('DESIGN_EXISTS');
    const created = { portfolioId, revision: 1, design, updatedAt: new Date() };
    this.stored.set(portfolioId, created);
    return created;
  }
  update(portfolioId: string, expectedRevision: number, design: DesignSpec): Promise<StoredDesign | null> {
    const current = this.stored.get(portfolioId);
    if (current?.revision !== expectedRevision) return Promise.resolve(null);
    const updated = { ...current, revision: current.revision + 1, design };
    this.stored.set(portfolioId, updated);
    return Promise.resolve(updated);
  }
}

const portfolioId = new Types.ObjectId().toString();
const otherPortfolioId = new Types.ObjectId().toString();

function stacked(section: CustomLayout['section']): CustomLayout {
  const children = Object.entries(LAYOUT_BLOCKS[section]).map(([block, styles]) => ({ kind: 'block' as const, block, style: styles[0] ?? null }));
  return { section, align: 'start', body: { kind: 'stack', gap: 'md', columns: null, children } };
}

const withLayout = (section: string, ref: string): DesignSpec =>
  ({ ...DEFAULT_DESIGN, layout: { ...DEFAULT_DESIGN.layout, [section]: ref } });

let layouts: InMemoryLayoutLibrary;
let presets: InMemoryPresetRepository;
let designs: DesignService;
let library: DesignLibraryService;

beforeEach(() => {
  layouts = new InMemoryLayoutLibrary();
  presets = new InMemoryPresetRepository();
  const validator = new DesignValidator();
  designs = new DesignService(new FakeDesigns(), validator, layouts);
  library = new DesignLibraryService(layouts, presets, designs, validator, new ManualClock(new Date('2026-10-21T10:00:00Z')));
});

describe('saving layouts', () => {
  it('validates each layout and stores them all', async () => {
    const saved = await library.saveLayouts(portfolioId, [
      { name: 'Work', layout: stacked('work'), source: 'ai' },
      { name: 'About', layout: stacked('about'), source: 'ai' },
    ]);
    expect(saved.map((row) => row.section)).toEqual(['work', 'about']);
    await expect(library.listLayouts(portfolioId)).resolves.toHaveLength(2);
  });

  it('stores none when any is invalid, reporting its index', async () => {
    const broken = { ...stacked('work'), body: { kind: 'stack', gap: 'md', columns: null, children: [] } };
    await expect(library.saveLayouts(portfolioId, [{ name: 'ok', layout: stacked('about'), source: 'ai' }, { name: 'bad', layout: broken, source: 'ai' }])).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { errors: expect.arrayContaining([expect.objectContaining({ path: expect.stringMatching(/^layouts\.1\./) as unknown })]) as unknown },
    });
    await expect(library.listLayouts(portfolioId)).resolves.toEqual([]);
  });

  it(`refuses past ${String(LAYOUT_LIBRARY_MAX)} with LIBRARY_FULL`, async () => {
    await layouts.insertMany(portfolioId, Array.from({ length: LAYOUT_LIBRARY_MAX }, () => ({ name: 'x', layout: stacked('work'), source: 'ai' as const })), new Date());
    await expect(library.saveLayouts(portfolioId, [{ name: 'one more', layout: stacked('work'), source: 'ai' }])).rejects.toMatchObject({
      status: 409,
      code: 'LIBRARY_FULL',
      details: { max: LAYOUT_LIBRARY_MAX },
    });
  });
});

describe('design-library.AC2 — a design may name only its own library layouts', () => {
  it('accepts a library layout for that section; refuses another section, another portfolio, and an unknown id', async () => {
    const [work] = await library.saveLayouts(portfolioId, [{ name: 'Work', layout: stacked('work'), source: 'ai' }]);
    const ref = `custom:${work?.id ?? ''}`;
    await expect(designs.apply(portfolioId, withLayout('work', ref), 0)).resolves.toMatchObject({ revision: 1, layout: { work: ref } });
    for (const [owner, section, layoutRef] of [
      [portfolioId, 'about', ref],
      [otherPortfolioId, 'work', ref],
      [portfolioId, 'work', `custom:${new Types.ObjectId().toString()}`],
    ] as const) {
      await expect(designs.apply(owner, withLayout(section, layoutRef), owner === portfolioId ? 1 : 0)).rejects.toMatchObject({
        code: 'VALIDATION_FAILED',
        details: { errors: [{ path: `layout.${section}`, message: 'This layout is not in your library for this section' }] },
      });
    }
  });
});

describe('design-library.AC5 — a layout in use is not deleted', () => {
  it('names the draft and the preset that use it; deletes it once free', async () => {
    const [work] = await library.saveLayouts(portfolioId, [{ name: 'Work', layout: stacked('work'), source: 'ai' }]);
    const id = work?.id ?? '';
    await designs.apply(portfolioId, withLayout('work', `custom:${id}`), 0);
    const preset = await library.savePresetFromDraft(portfolioId, 'With custom work');
    await expect(library.deleteLayout(portfolioId, id)).rejects.toMatchObject({ code: 'LAYOUT_IN_USE', details: { usedBy: ['draft', 'preset'] } });
    await designs.apply(portfolioId, DEFAULT_DESIGN, 1);
    await expect(library.deleteLayout(portfolioId, id)).rejects.toMatchObject({ details: { usedBy: ['preset'] } });
    await library.deletePreset(portfolioId, preset.id);
    await expect(library.deleteLayout(portfolioId, id)).resolves.toBeUndefined();
    await expect(library.deleteLayout(portfolioId, id)).rejects.toMatchObject({ status: 404 });
  });
});

describe('design-library.AC6 — presets', () => {
  it('saves the draft, lists, applies with the current revision, refuses a stale one, deletes', async () => {
    await designs.apply(portfolioId, { ...DEFAULT_DESIGN, layout: { ...DEFAULT_DESIGN.layout, hero: 'centered' } }, 0);
    const preset = await library.savePresetFromDraft(portfolioId, 'Centred hero');
    expect(preset).toMatchObject({ name: 'Centred hero', design: { layout: { hero: 'centered' } } });
    await expect(library.listPresets(portfolioId)).resolves.toEqual([preset]);

    await designs.apply(portfolioId, DEFAULT_DESIGN, 1);
    await expect(library.applyPreset(portfolioId, preset.id, 1)).rejects.toMatchObject({ code: 'REVISION_CONFLICT', details: { currentRevision: 2 } });
    await expect(library.applyPreset(portfolioId, preset.id, 2)).resolves.toMatchObject({ revision: 3, layout: { hero: 'centered' } });
    await expect(library.applyPreset(otherPortfolioId, preset.id, 0)).rejects.toMatchObject({ status: 404 });
    await library.deletePreset(portfolioId, preset.id);
    await expect(library.deletePreset(portfolioId, preset.id)).rejects.toMatchObject({ status: 404 });
  });

  it('savePreset validates the design and its layout references; refuses past the limit', async () => {
    await expect(library.savePreset(portfolioId, 'Broken', { theme: 'nope', layout: {} })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(library.savePreset(portfolioId, 'Ghost', withLayout('work', `custom:${new Types.ObjectId().toString()}`))).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    for (let index = 0; index < PRESET_LIBRARY_MAX; index += 1) await library.savePreset(portfolioId, `P${String(index)}`, DEFAULT_DESIGN);
    await expect(library.savePreset(portfolioId, 'One more', DEFAULT_DESIGN)).rejects.toMatchObject({ code: 'LIBRARY_FULL', details: { max: PRESET_LIBRARY_MAX } });
  });
});
