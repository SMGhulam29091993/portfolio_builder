/**
 * `DesignSpecParser` (`ai-design-studio.T03`; UT03–UT06; AC3, AC4, AC5). The validator is a
 * test double over the same `validateDesign` that `design`'s `DesignValidator` wraps, so the
 * verdicts are the real ones without importing another module's class.
 */
import { DEFAULT_DESIGN, type DesignSpec } from '@portfolio/design-tokens';
import { describe, expect, it } from 'vitest';

import { TokensDesignValidator } from '../../testing/index.js';
import { DesignSpecParser } from './design-spec.parser.js';

const parser = new DesignSpecParser(new TokensDesignValidator());
const current: DesignSpec = DEFAULT_DESIGN;

/** A valid answer that differs from the current design in both parts. */
const proposed = {
  theme: {
    ...DEFAULT_DESIGN.theme,
    colors: { ...DEFAULT_DESIGN.theme.colors, accent: '#7dd3fc' },
    fonts: { sans: 'manrope', display: 'fraunces', mono: 'fira-code' },
  },
  layout: { hero: 'centered', about: 'stacked', work: 'list', experience: 'cards', stack: 'columns', contact: 'minimal' },
  rationale: 'Cooler accent, calmer layouts.',
};

const text = (value: unknown) => JSON.stringify(value);

describe('DesignSpecParser', () => {
  describe('ai-design-studio.UT03 / AC3 — refuses what cannot be used, with reasons', () => {
    it.each([
      ['prose', 'Here is a calm design with a blue accent.'],
      ['an empty answer', ''],
      ['truncated JSON', text(proposed).slice(0, 80)],
      ['an array of strings', text(['not', 'a', 'design'])],
    ])('%s is INVALID_OUTPUT', (_case, answer) => {
      expect(parser.parse(answer, 'both', current)).toMatchObject({ ok: false, code: 'INVALID_OUTPUT' });
    });

    it('the wrong shape is INVALID_OUTPUT with paths', () => {
      const verdict = parser.parse(text({ theme: { colors: 'blue' }, layout: proposed.layout }), 'both', current);
      expect(verdict).toMatchObject({ ok: false, code: 'INVALID_OUTPUT' });
      expect(!verdict.ok && verdict.issues.some((issue) => issue.path.startsWith('theme'))).toBe(true);
    });

    it('an unknown variant or font is INVALID_OUTPUT naming the path', () => {
      const variant = parser.parse(text({ ...proposed, layout: { ...proposed.layout, hero: 'carousel' } }), 'both', current);
      expect(variant).toMatchObject({ ok: false, code: 'INVALID_OUTPUT', issues: [{ path: 'layout.hero' }] });
      const font = parser.parse(
        text({ ...proposed, theme: { ...proposed.theme, fonts: { ...proposed.theme.fonts, sans: 'comic-sans' } } }),
        'both',
        current,
      );
      expect(font).toMatchObject({ ok: false, code: 'INVALID_OUTPUT', issues: [{ path: 'theme.fonts.sans' }] });
    });

    it.each([
      ['a URL in the rationale', { ...proposed, rationale: 'Inspired by https://example.com' }, 'rationale'],
      ['a www host in the rationale', { ...proposed, rationale: 'See www.example.com' }, 'rationale'],
      ['markup in a field', { ...proposed, layout: { ...proposed.layout, hero: '<div>centered</div>' } }, 'layout.hero'],
      ['markup in an extra key', { ...proposed, extra: { note: '<img src=x onerror=alert(1)>' } }, 'extra.note'],
      ['a javascript: scheme', { ...proposed, rationale: 'javascript:alert(1)' }, 'rationale'],
    ])('%s is INVALID_OUTPUT at its path', (_case, answer, path) => {
      expect(parser.parse(text(answer), 'both', current)).toMatchObject({ ok: false, code: 'INVALID_OUTPUT', issues: [{ path }] });
    });

    it('a non-string rationale is INVALID_OUTPUT', () => {
      expect(parser.parse(text({ ...proposed, rationale: 42 }), 'both', current)).toMatchObject({
        ok: false,
        code: 'INVALID_OUTPUT',
        issues: [{ path: 'rationale' }],
      });
    });
  });

  describe('ai-design-studio.UT04 / AC3 — finds the JSON a model wraps', () => {
    it('fenced JSON with prose around it parses and is valid', () => {
      const answer = `Sure! Here you go:\n\`\`\`json\n${JSON.stringify(proposed, null, 2)}\n\`\`\`\nHope you like it.`;
      expect(parser.parse(answer, 'both', current)).toEqual({
        ok: true,
        design: { theme: proposed.theme, layout: proposed.layout },
        rationale: proposed.rationale,
      });
    });

    it('takes the first object that parses, skipping braces in prose', () => {
      const answer = `Options {draft} first: ${text(proposed)} and another: ${text({ ...proposed, rationale: 'second' })}`;
      expect(parser.parse(answer, 'both', current)).toMatchObject({ ok: true, rationale: proposed.rationale });
    });

    it('an object inside an array is still found, and still fully validated', () => {
      expect(parser.parse(text([proposed]), 'both', current)).toMatchObject({ ok: true });
      expect(parser.parse(text([{ ...proposed, layout: { ...proposed.layout, hero: 'carousel' } }]), 'both', current)).toMatchObject({
        ok: false,
        code: 'INVALID_OUTPUT',
      });
    });

    it('braces inside JSON strings do not end the object', () => {
      expect(parser.parse(text({ ...proposed, rationale: 'Balanced {curly} "quoted" text' }), 'both', current)).toMatchObject({
        ok: true,
        rationale: 'Balanced {curly} "quoted" text',
      });
    });

    it('strips extra keys, normalises upper-case hex, cleans and caps the rationale; empty becomes null', () => {
      const shouted = { ...proposed, theme: { ...proposed.theme, colors: { ...proposed.theme.colors, accent: '#7DD3FC' } }, mood: 'calm' };
      const verdict = parser.parse(text({ ...shouted, rationale: `  ${'x'.repeat(500)}  ` }), 'both', current);
      expect(verdict).toMatchObject({ ok: true });
      if (!verdict.ok) return;
      expect(verdict.design.theme.colors.accent).toBe('#7dd3fc');
      expect(verdict.design).not.toHaveProperty('mood');
      expect(verdict.rationale).toHaveLength(400);
      expect(parser.parse(text({ ...proposed, rationale: '   ' }), 'both', current)).toMatchObject({ ok: true, rationale: null });
      const withoutRationale = Object.fromEntries(Object.entries(proposed).filter(([key]) => key !== 'rationale'));
      expect(parser.parse(text(withoutRationale), 'both', current)).toMatchObject({ ok: true, rationale: null });
    });
  });

  describe('ai-design-studio.UT05 / AC4 — contrast', () => {
    it('a well-formed, low-contrast design is CONTRAST_FAILED listing the measured ratios', () => {
      const low = { ...proposed, theme: { ...proposed.theme, colors: { ...proposed.theme.colors, text: '#1a1a1c' } } };
      const verdict = parser.parse(text(low), 'both', current);
      expect(verdict).toMatchObject({ ok: false, code: 'CONTRAST_FAILED' });
      if (verdict.ok) return;
      expect(verdict.issues.length).toBeGreaterThan(0);
      for (const issue of verdict.issues) {
        expect(issue.path).toMatch(/^theme\.colors\./);
        expect(issue.message).toMatch(/\d+\.\d{2}:1/);
      }
    });

    it('contrast failures mixed with another problem are INVALID_OUTPUT', () => {
      const mixed = {
        theme: { ...proposed.theme, colors: { ...proposed.theme.colors, text: '#1a1a1c' } },
        layout: { ...proposed.layout, hero: 'carousel' },
      };
      expect(parser.parse(text(mixed), 'both', current)).toMatchObject({ ok: false, code: 'INVALID_OUTPUT' });
    });
  });

  describe('ai-design-studio.UT06 / AC5 — scope merge', () => {
    it('theme: the layout is the current one, whatever the model returned — even an invalid one', () => {
      const answer = { ...proposed, layout: { ...proposed.layout, hero: 'carousel' } };
      expect(parser.parse(text(answer), 'theme', current)).toMatchObject({
        ok: true,
        design: { theme: proposed.theme, layout: current.layout },
      });
    });

    it('layout: the theme is the current one', () => {
      const answer = { ...proposed, theme: { colors: 'ignored' } };
      expect(parser.parse(text(answer), 'layout', current)).toMatchObject({
        ok: true,
        design: { theme: current.theme, layout: proposed.layout },
      });
    });

    it('both: the model provides both parts', () => {
      expect(parser.parse(text(proposed), 'both', current)).toMatchObject({
        ok: true,
        design: { theme: proposed.theme, layout: proposed.layout },
      });
    });
  });
});

describe('custom layouts in the answer (design-library.AC7)', () => {
  const block = (name: string, style: string | null = null) => ({ kind: 'block', block: name, style });
  const workLayout = { section: 'work', align: 'start', body: { kind: 'columns', gap: 'md', columns: '1-2', children: [block('featured'), block('projects', 'list')] } };
  const answer = (customLayouts: unknown) => text({ ...proposed, customLayouts });

  it('keeps valid custom layouts for scope both and layout, and drops them for theme', () => {
    const all = { hero: null, about: null, work: workLayout, experience: null, stack: null, contact: null };
    expect(parser.parse(answer(all), 'both', current)).toMatchObject({ ok: true, design: { customLayouts: { work: workLayout } } });
    expect(parser.parse(answer(all), 'layout', current)).toMatchObject({ ok: true, design: { customLayouts: { work: workLayout } } });
    const themeOnly = parser.parse(answer(all), 'theme', current);
    expect(themeOnly.ok && themeOnly.design).not.toHaveProperty('customLayouts');
  });

  it('no layouts, or all null, adds nothing', () => {
    const none = parser.parse(answer({ hero: null }), 'both', current);
    expect(none.ok && none.design).not.toHaveProperty('customLayouts');
    expect(parser.parse(text(proposed), 'both', current)).toMatchObject({ ok: true });
  });

  it('an invalid layout is INVALID_OUTPUT with its path, for the repair attempt', () => {
    const missingBlock = { ...workLayout, body: { kind: 'stack', gap: 'md', columns: null, children: [block('projects', 'grid')] } };
    expect(parser.parse(answer({ work: missingBlock }), 'both', current)).toEqual({
      ok: false,
      code: 'INVALID_OUTPUT',
      issues: [{ path: 'customLayouts.work.body', message: 'Missing the featured block' }],
    });
    const wrongSection = parser.parse(answer({ about: workLayout }), 'both', current);
    expect(wrongSection).toMatchObject({ ok: false, code: 'INVALID_OUTPUT', issues: expect.arrayContaining([{ path: 'customLayouts.about.section', message: 'This layout is for work, not about' }]) as unknown });
    expect(parser.parse(answer('columns please'), 'both', current)).toMatchObject({ ok: false, issues: [{ path: 'customLayouts', message: 'Must be an object' }] });
  });
});
