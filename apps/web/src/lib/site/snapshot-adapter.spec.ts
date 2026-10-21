/** `adaptSnapshot` (`public-site-rendering.UT07`; AC16). */
import { DEFAULT_DESIGN, LAYOUT_BLOCKS, type CustomLayout } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import { publicPortfolioFixture } from './site-fixtures';
import { adaptSnapshot, UnsupportedSnapshotVersionError } from './snapshot-adapter';

function stacked(section: CustomLayout['section']): CustomLayout {
  const children = Object.entries(LAYOUT_BLOCKS[section]).map(([block, styles]) => ({ kind: 'block' as const, block, style: styles[0] ?? null }));
  return { section, align: 'start', body: { kind: 'stack', gap: 'md', columns: null, children } };
}

describe('adaptSnapshot', () => {
  it('version 1 becomes renderer props', () => {
    const { content } = publicPortfolioFixture();
    const adapted = adaptSnapshot(content);
    expect(adapted.identity.fullName).toBe('Ada Lovelace');
    expect(adapted.theme).toEqual(DEFAULT_DESIGN.theme);
    expect(adapted.layout).toEqual(DEFAULT_DESIGN.layout);
    expect(adapted.sections).toEqual(content.sections);
  });

  it('an unreadable theme falls back to the default rather than failing', () => {
    const { content } = publicPortfolioFixture();
    expect(adaptSnapshot({ ...content, design: { theme: { colors: 'x' } } }).theme).toEqual(DEFAULT_DESIGN.theme);
  });

  it('version 1 has no custom layouts', () => {
    expect(adaptSnapshot(publicPortfolioFixture().content).customLayouts).toEqual({});
  });

  it('design-library.AC4 — version 2 carries its custom layouts; one this build cannot read is left out', () => {
    const { content } = publicPortfolioFixture();
    const work = stacked('work');
    const adapted = adaptSnapshot({
      ...content,
      schemaVersion: 2,
      design: { ...content.design, customLayouts: { work, about: { section: 'about', body: 'nope' }, stack: stacked('hero') } },
    });
    expect(adapted.customLayouts).toEqual({ work });
    expect(adapted.layout).toEqual(DEFAULT_DESIGN.layout);
  });

  it('a version newer than this build, or no version, is unsupported', () => {
    const { content } = publicPortfolioFixture();
    expect(() => adaptSnapshot({ ...content, schemaVersion: 3 })).toThrow(UnsupportedSnapshotVersionError);
    expect(() => adaptSnapshot(null)).toThrow(UnsupportedSnapshotVersionError);
  });
});
