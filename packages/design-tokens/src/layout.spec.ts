/** Custom layouts (`design-library.T01`; UT01, UT02; AC1). */
import { describe, expect, it } from 'vitest';

import {
  customLayoutId,
  DEFAULT_DESIGN,
  isCustomLayoutRef,
  LAYOUT_BLOCKS,
  SECTION_TYPES,
  validateCustomLayout,
  validateDesign,
  type CustomLayout,
} from './index.js';

const block = (name: string, style: string | null = null) => ({ kind: 'block' as const, block: name, style });

/** A valid layout for each section: its blocks stacked, each with its first style. */
function stacked(section: (typeof SECTION_TYPES)[number]): CustomLayout {
  const children = Object.entries(LAYOUT_BLOCKS[section]).map(([name, styles]) => block(name, styles[0] ?? null));
  return { section, align: 'start', body: { kind: 'stack', gap: 'md', columns: null, children } };
}

const about: CustomLayout = {
  section: 'about',
  align: 'center',
  body: {
    kind: 'stack',
    gap: 'lg',
    columns: null,
    children: [
      { kind: 'columns', gap: 'md', columns: '2-1', children: [block('bio'), block('currently')] },
      { kind: 'columns', gap: 'sm', columns: '1-1', children: [block('stats', 'four-columns'), block('process', 'list')] },
    ],
  },
};

const issues = (input: unknown, section?: (typeof SECTION_TYPES)[number]) => {
  const verdict = validateCustomLayout(input, section);
  return verdict.ok ? [] : verdict.issues;
};

describe('validateCustomLayout (design-library.UT01 / AC1)', () => {
  it.each(SECTION_TYPES)('accepts every block of %s, stacked', (section) => {
    expect(validateCustomLayout(stacked(section), section)).toMatchObject({ ok: true });
  });

  it('accepts a two-level arrangement with columns and styles', () => {
    expect(validateCustomLayout(about, 'about')).toEqual({ ok: true, layout: about });
  });

  it('refuses a missing block and a block drawn twice', () => {
    const missing = { ...about, body: { ...about.body, children: [about.body.children[0]] } };
    expect(issues(missing)).toEqual(
      expect.arrayContaining([
        { path: 'body', message: 'Missing the stats block' },
        { path: 'body', message: 'Missing the process block' },
      ]),
    );
    const twice = stacked('work');
    twice.body.children.push(block('featured'));
    expect(issues(twice)).toContainEqual({ path: 'body', message: 'The featured block appears 2 times' });
  });

  it('refuses a block from another section, a missing or wrong style, and a style on a plain block', () => {
    const layout = stacked('work');
    layout.body.children = [block('bio'), block('projects', 'carousel'), block('featured', 'big')];
    expect(issues(layout)).toEqual(
      expect.arrayContaining([
        { path: 'body.children.0.block', message: 'Not a block of the work section' },
        { path: 'body.children.1.style', message: 'Choose one of: grid, list' },
        { path: 'body.children.2.style', message: 'This block has no styles' },
      ]),
    );
  });

  it('pairs columns with kind and child counts', () => {
    const noSplit = { ...about, body: { ...about.body, kind: 'columns' as const } };
    expect(issues(noSplit)).toContainEqual({ path: 'body.columns', message: 'Columns need a column split' });
    const stackWithSplit = { ...about, body: { ...about.body, columns: '1-1' as const } };
    expect(issues(stackWithSplit)).toContainEqual({ path: 'body.columns', message: 'A stack has no column split' });
    const threeInTwo = {
      ...about,
      body: { ...about.body, children: [{ kind: 'columns', gap: 'md', columns: '1-1', children: [block('bio'), block('currently'), block('stats', 'two-columns')] }, block('process', 'row')] },
    };
    expect(issues(threeInTwo)).toContainEqual({ path: 'body.children.0.children', message: 'A 1-1 split takes 2 children' });
  });

  it('refuses the wrong section, too many children, a third level and junk', () => {
    expect(issues(about, 'work')).toContainEqual({ path: 'section', message: 'This layout is for about, not work' });
    const tooMany = { ...about, body: { ...about.body, children: Array.from({ length: 5 }, () => block('bio')) } };
    expect(issues(tooMany).some((issue) => issue.path === 'body.children')).toBe(true);
    const deep = { ...about, body: { ...about.body, children: [{ kind: 'stack', gap: 'md', columns: null, children: [{ kind: 'stack', gap: 'md', columns: null, children: [block('bio')] }] }] } };
    expect(issues(deep).length).toBeGreaterThan(0);
    expect(issues('<div>layout</div>').length).toBeGreaterThan(0);
  });
});

describe('custom layout references (design-library.UT02)', () => {
  const id = '0123456789abcdef01234567';

  it('recognises custom:<24-hex id> only', () => {
    expect(isCustomLayoutRef(`custom:${id}`)).toBe(true);
    expect(customLayoutId(`custom:${id}`)).toBe(id);
    for (const value of ['custom:', 'custom:xyz', `custom:${id}0`, 'bento', `Custom:${id}`]) {
      expect(isCustomLayoutRef(value)).toBe(false);
      expect(customLayoutId(value)).toBeUndefined();
    }
  });

  it('validateDesign accepts a well-formed reference and still refuses unknown variants', () => {
    const design = JSON.parse(JSON.stringify(DEFAULT_DESIGN)) as { layout: Record<string, string> };
    design.layout.work = `custom:${id}`;
    expect(validateDesign(design)).toMatchObject({ ok: true });
    design.layout.work = 'custom:nope';
    expect(validateDesign(design)).toMatchObject({ ok: false, issues: [{ path: 'layout.work' }] });
  });
});
