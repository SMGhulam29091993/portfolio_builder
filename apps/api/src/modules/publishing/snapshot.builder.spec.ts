/**
 * `SnapshotBuilder` and `DraftAssembler` (`publish-pipeline.UT05`; AC9, AC10).
 */
import { SNAPSHOT_SCHEMA_VERSION } from '@portfolio/contracts';
import { DEFAULT_DESIGN } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import { cleanContent } from '../../testing/index.js';
import { CanonicalHasher } from './canonical-hasher.js';
import { DraftAssembler } from './draft.assembler.js';
import type { AnyDraftContributor, IPublishedAssetSource } from './publishing.interface.js';
import type { DraftParts } from './publishing.types.js';
import { SnapshotBuilder } from './snapshot.builder.js';

const RESUME = { id: 'res-1', kind: 'resume' as const, filename: 'cv.pdf', mime: 'application/pdf', sizeBytes: 10, sha256: 'a'.repeat(64) };
const IMAGE = { id: 'img-1', kind: 'image' as const, filename: 'og.png', mime: 'image/png', sizeBytes: 20, sha256: 'b'.repeat(64) };

/** Knows `res-1` and `img-1` in portfolio `p1`. */
const assets: IPublishedAssetSource = {
  findById: (portfolioId, id) => Promise.resolve(portfolioId === 'p1' ? ([RESUME, IMAGE].find((asset) => asset.id === id) ?? null) : null),
};

function parts(): DraftParts {
  const content = cleanContent();
  const data = (type: string) => content.sections.find((section) => section.type === type)?.data;
  return {
    sections: {
      order: ['hero', 'work', 'about', 'stack'],
      sections: [
        { type: 'about', visible: true, data: data('about') },
        { type: 'stack', visible: false, data: data('stack') },
        { type: 'hero', visible: true, data: data('hero') },
        { type: 'work', visible: true, data: data('work') },
      ],
    },
    identity: { ...content.identity, resume: { ...content.identity.resume, assetId: 'res-1' }, seo: { ...content.identity.seo, ogImageAssetId: 'gone' } },
    design: { theme: DEFAULT_DESIGN.theme, layout: DEFAULT_DESIGN.layout },
  };
}

describe('publish-pipeline.UT05 — SnapshotBuilder', () => {
  it('keeps visible sections only, hero first then the order; lists exactly the existing referenced assets', async () => {
    const content = await new SnapshotBuilder(assets).build('p1', parts());
    expect(content.schemaVersion).toBe(SNAPSHOT_SCHEMA_VERSION);
    expect(content.schemaVersion).toBe(2);
    // No custom layouts named: the field is left out, as in version-1 content.
    expect(content.design).not.toHaveProperty('customLayouts');
    expect(content.sections.map((section) => section.type)).toEqual(['hero', 'work', 'about']);
    expect(content.assets).toEqual([RESUME]);
    expect(content.design.layout).toEqual(DEFAULT_DESIGN.layout);
  });

  it('design-library.AC4 — stores a copy of the custom layouts, independent of the draft', async () => {
    const draft = parts();
    const layout = { section: 'work', align: 'start', body: { kind: 'stack', gap: 'md', columns: null, children: [] } };
    const customLayouts: Record<string, unknown> = { work: layout };
    const content = await new SnapshotBuilder(assets).build('p1', { ...draft, design: { ...draft.design, customLayouts } });
    expect(content.design.customLayouts).toEqual({ work: layout });
    // A later change to the draft's object does not reach the snapshot.
    (layout as { align: string }).align = 'center';
    expect(content.design.customLayouts).toEqual({ work: { ...layout, align: 'start' } });
  });

  it('places a section missing from the order last, and finds nothing in another portfolio', async () => {
    const draft = parts();
    const content = await new SnapshotBuilder(assets).build('p2', {
      ...draft,
      sections: { order: ['work'], sections: draft.sections.sections },
    });
    expect(content.sections.map((section) => section.type)).toEqual(['work', 'about', 'hero']);
    expect(content.assets).toEqual([]);
  });
});

describe('DraftAssembler', () => {
  function contributors(draft: DraftParts): AnyDraftContributor[] {
    return [
      { key: 'design', collect: () => Promise.resolve(draft.design) },
      { key: 'sections', collect: () => Promise.resolve(draft.sections) },
      { key: 'identity', collect: () => Promise.resolve(draft.identity) },
    ];
  }

  it('publish-pipeline.AC10 — the hash does not depend on contributor order', async () => {
    const builder = new SnapshotBuilder(assets);
    const hasher = new CanonicalHasher();
    const draft = parts();
    const one = await new DraftAssembler(contributors(draft), builder, hasher).assemble({ portfolioId: 'p1', userId: 'u1' });
    const two = await new DraftAssembler(contributors(draft).reverse(), builder, hasher).assemble({ portfolioId: 'p1', userId: 'u1' });
    expect(one.contentHash).toBe(two.contentHash);
    expect(one.contentHash).toBe(hasher.hash(one.content));
  });

  it('refuses a missing or doubled contributor at construction', () => {
    const builder = new SnapshotBuilder(assets);
    const list = contributors(parts());
    expect(() => new DraftAssembler(list.slice(1), builder, new CanonicalHasher())).toThrow(/"design"/);
    const [, sections] = list;
    if (!sections) throw new Error('fixture');
    expect(() => new DraftAssembler([...list, sections], builder, new CanonicalHasher())).toThrow(/"sections"/);
  });
});
