/** `sectionNav` — `cms-panel-shell.AC4` order rule. */
import { describe, expect, it } from 'vitest';

import { FIXED_AREAS, sectionNav } from './nav';

const info = (type: string, orderable = true) => ({ type, label: type.toUpperCase(), orderable, hideable: orderable, inNav: orderable });

describe('sectionNav', () => {
  it('puts the non-orderable type first, then the stored order, then unlisted types', () => {
    const nav = sectionNav([info('about'), info('hero', false), info('work'), info('stack')], ['work', 'about']);

    expect(nav.map((item) => item.href)).toEqual([
      '/cms/sections/hero',
      '/cms/sections/work',
      '/cms/sections/about',
      '/cms/sections/stack',
    ]);
  });

  it('lists the fixed areas in order', () => {
    expect(FIXED_AREAS.map((item) => item.label)).toEqual(['Identity', 'Design', 'Assets', 'AI Studio', 'Publish']);
  });
});
