/**
 * `publish-pipeline.CT01` — `IDraftContributor` for `design`, and the `design-valid` check
 * (`publish-pipeline.T02`).
 */
import { DEFAULT_DESIGN, designSpecSchema, LAYOUT_BLOCKS, type CustomLayout } from '@portfolio/design-tokens';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { InMemoryLayoutLibrary } from '../../testing/index.js';
import { DesignDraftContributor } from './design-draft.contributor.js';

function stacked(section: CustomLayout['section']): CustomLayout {
  const children = Object.entries(LAYOUT_BLOCKS[section]).map(([block, styles]) => ({ kind: 'block' as const, block, style: styles[0] ?? null }));
  return { section, align: 'start', body: { kind: 'stack', gap: 'md', columns: null, children } };
}
import { DesignPublishCheck } from './design-publish.check.js';

describe('publish-pipeline.CT01 — DesignDraftContributor', () => {
  it('returns the theme and layout without the revision', async () => {
    const contributor = new DesignDraftContributor({ read: () => Promise.resolve({ ...DEFAULT_DESIGN, revision: 0 }) }, new InMemoryLayoutLibrary());
    const design = await contributor.collect({ portfolioId: 'p1', userId: 'u1' });
    expect(contributor.key).toBe('design');
    expect(design).toEqual({ theme: DEFAULT_DESIGN.theme, layout: DEFAULT_DESIGN.layout });
    expect(designSpecSchema.safeParse(design).success).toBe(true);
  });

  it('design-library.AC4 — adds a copy of each library layout the design names', async () => {
    const portfolioId = new Types.ObjectId().toString();
    const library = new InMemoryLayoutLibrary();
    const [work] = await library.insertMany(portfolioId, [{ name: 'w', layout: stacked('work'), source: 'ai' }], new Date());
    const missing = `custom:${new Types.ObjectId().toString()}`;
    const layout = { ...DEFAULT_DESIGN.layout, work: `custom:${work?.id ?? ''}`, about: missing };
    const contributor = new DesignDraftContributor({ read: () => Promise.resolve({ ...DEFAULT_DESIGN, layout, revision: 3 }) }, library);
    const design = await contributor.collect({ portfolioId, userId: 'u1' });
    // The missing one is left out; the publish check then names it.
    expect(design).toEqual({ theme: DEFAULT_DESIGN.theme, layout, customLayouts: { work: stacked('work') } });
  });
});

describe('DesignPublishCheck', () => {
  const check = new DesignPublishCheck();
  const visible = ['hero', 'about'];

  it('passes the default design', () => {
    expect(check.check(DEFAULT_DESIGN, visible)).toEqual([]);
  });

  it('reports a contrast failure with its path', () => {
    const design = { ...DEFAULT_DESIGN, theme: { ...DEFAULT_DESIGN.theme, colors: { ...DEFAULT_DESIGN.theme.colors, textMuted: DEFAULT_DESIGN.theme.colors.background } } };
    expect(check.check(design, visible).map((issue) => issue.path)).toContain('theme.colors.textMuted');
  });

  it('reports a visible section without a layout once, and an unknown visible type', () => {
    const design = { ...DEFAULT_DESIGN, layout: { ...DEFAULT_DESIGN.layout, about: 'nope' } };
    const issues = check.check(design, [...visible, 'gallery']);
    expect(issues.filter((issue) => issue.path === 'layout.about')).toHaveLength(1);
    expect(issues).toContainEqual({ path: 'layout.gallery', message: 'This visible section has no layout' });
  });

  it('design-library.AC4 — accepts a resolved custom layout; names one that did not resolve', () => {
    const ref = `custom:${new Types.ObjectId().toString()}`;
    const design = { ...DEFAULT_DESIGN, layout: { ...DEFAULT_DESIGN.layout, about: ref } };
    expect(check.check({ ...design, customLayouts: { about: stacked('about') } }, visible)).toEqual([]);
    expect(check.check(design, visible)).toEqual([{ path: 'layout.about', message: 'This section uses a custom layout that is no longer in your library' }]);
  });

  it('reads what it can from a malformed design', () => {
    expect(check.check(null, ['hero']).map((issue) => issue.path)).toContain('layout.hero');
    expect(check.check({ layout: 'x' }, ['hero']).map((issue) => issue.path)).toContain('layout.hero');
  });
});
