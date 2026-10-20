/** `packages/design-tokens` — `design-theme.UT01`–`UT03`, `UT06`–`UT08` (AC3, AC4, AC7). */
import { describe, expect, it } from 'vitest';

import {
  checkContrast,
  contrastRatio,
  DEFAULT_DESIGN,
  hexColorSchema,
  referenceVariant,
  toCssVariables,
  validateDesign,
  VARIANT_CATALOGUE,
  type DesignSpec,
} from './index.js';

const clone = (): DesignSpec => JSON.parse(JSON.stringify(DEFAULT_DESIGN)) as DesignSpec;

describe('contrast (design-theme.UT01)', () => {
  it('measures the WCAG extremes and a known mid value', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#123456', '#123456')).toBe(1);
  });

  it('design-theme.UT08 / AC1 — the default design passes every pair and validates', () => {
    expect(checkContrast(DEFAULT_DESIGN.theme.colors).every((pair) => pair.passes)).toBe(true);
    expect(validateDesign(DEFAULT_DESIGN)).toEqual({ ok: true, design: DEFAULT_DESIGN });
  });
});

describe('validateDesign', () => {
  it('design-theme.UT02 / AC4 — each failing pair is reported at its foreground with the ratio', () => {
    const design = clone();
    design.theme.colors.text = '#111111';

    const verdict = validateDesign(design);

    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.issues.map((issue) => issue.path)).toEqual(['theme.colors.text', 'theme.colors.text', 'theme.colors.text']);
    expect(verdict.issues[0]?.message).toMatch(/^Contrast with background is \d+\.\d\d:1; at least 4\.5:1 is required$/);
  });

  it('checks the accent pair at 3:1', () => {
    const design = clone();
    design.theme.colors.accent = '#2a2a2a';
    design.theme.colors.onAccent = '#ffffff';

    const verdict = validateDesign(design);
    expect(verdict.ok ? [] : verdict.issues.map((issue) => issue.message)).toContainEqual(expect.stringContaining('at least 3:1'));
  });

  it('design-theme.UT03 / AC3 — bad hex, unknown font, wrong-role font, foreign variant', () => {
    const shape = validateDesign({ ...clone(), theme: { ...clone().theme, colors: { ...clone().theme.colors, accent: '#abc' } } });
    expect(shape.ok ? [] : shape.issues.map((issue) => issue.path)).toEqual(['theme.colors.accent']);

    const design = clone();
    design.theme.fonts.sans = 'comic-sans';
    design.theme.fonts.display = 'jetbrains-mono';
    design.layout.hero = 'bento';
    const verdict = validateDesign(design);
    expect(verdict.ok ? [] : verdict.issues.map((issue) => issue.path)).toEqual(['theme.fonts.sans', 'theme.fonts.display', 'layout.hero']);
  });

  it('requires every section key', () => {
    const layout: Partial<DesignSpec['layout']> = clone().layout;
    delete layout.contact;
    expect(validateDesign({ theme: clone().theme, layout }).ok).toBe(false);
  });
});

describe('hex (design-theme.UT07)', () => {
  it('normalises upper case and rejects 3- and 8-digit hex', () => {
    expect(hexColorSchema.parse('#ABCDEF')).toBe('#abcdef');
    expect(hexColorSchema.safeParse('#abc').success).toBe(false);
    expect(hexColorSchema.safeParse('#aabbccdd').success).toBe(false);
  });
});

describe('toCssVariables (design-theme.UT06 / AC7)', () => {
  it('emits every token and is byte-identical across calls', () => {
    const css = toCssVariables(DEFAULT_DESIGN.theme);

    expect(css).toBe(toCssVariables(clone().theme));
    expect(css).toContain('--color-background: #09090b;');
    expect(css).toContain('--color-surface-raised: #151517;');
    expect(css).toContain('--color-on-accent: #09090b;');
    expect(css).toContain('--font-display: var(--font-instrument-serif);');
    expect(css).toContain('--radius: 24px;');
    expect(css.split('\n')).toHaveLength(14);
  });
});

describe('catalogue', () => {
  it('has two variants per section, the reference first', () => {
    for (const variants of Object.values(VARIANT_CATALOGUE)) expect(variants).toHaveLength(2);
    expect(referenceVariant('hero')).toBe('split-code-card');
    expect(referenceVariant('blog')).toBeUndefined();
  });
});
