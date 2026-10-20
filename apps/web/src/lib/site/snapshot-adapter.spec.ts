/** `adaptSnapshot` (`public-site-rendering.UT07`; AC16). */
import { DEFAULT_DESIGN } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import { publicPortfolioFixture } from './site-fixtures';
import { adaptSnapshot, UnsupportedSnapshotVersionError } from './snapshot-adapter';

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

  it('version 2, or no version, is unsupported', () => {
    const { content } = publicPortfolioFixture();
    expect(() => adaptSnapshot({ ...content, schemaVersion: 2 })).toThrow(UnsupportedSnapshotVersionError);
    expect(() => adaptSnapshot(null)).toThrow(UnsupportedSnapshotVersionError);
  });
});
