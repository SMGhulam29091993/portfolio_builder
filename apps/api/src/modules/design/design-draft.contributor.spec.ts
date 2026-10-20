/**
 * `publish-pipeline.CT01` — `IDraftContributor` for `design`, and the `design-valid` check
 * (`publish-pipeline.T02`).
 */
import { DEFAULT_DESIGN, designSpecSchema } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import { DesignDraftContributor } from './design-draft.contributor.js';
import { DesignPublishCheck } from './design-publish.check.js';

describe('publish-pipeline.CT01 — DesignDraftContributor', () => {
  it('returns the theme and layout without the revision', async () => {
    const contributor = new DesignDraftContributor({ read: () => Promise.resolve({ ...DEFAULT_DESIGN, revision: 0 }) });
    const design = await contributor.collect({ portfolioId: 'p1', userId: 'u1' });
    expect(contributor.key).toBe('design');
    expect(design).toEqual({ theme: DEFAULT_DESIGN.theme, layout: DEFAULT_DESIGN.layout });
    expect(designSpecSchema.safeParse(design).success).toBe(true);
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

  it('reads what it can from a malformed design', () => {
    expect(check.check(null, ['hero']).map((issue) => issue.path)).toContain('layout.hero');
    expect(check.check({ layout: 'x' }, ['hero']).map((issue) => issue.path)).toContain('layout.hero');
  });
});
