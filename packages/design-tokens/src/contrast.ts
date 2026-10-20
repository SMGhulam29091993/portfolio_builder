/**
 * Contrast maths (`design-theme` spec → Contrast rule): WCAG 2.1 relative luminance and contrast
 * ratio, and the pairs every design must pass. One implementation, used by the API's validator
 * and the CMS's live badges.
 */
import type { ColorToken, ThemeTokens } from './schema.js';

/** Relative luminance of a `#rrggbb` colour (WCAG 2.1). */
export function relativeLuminance(hex: string): number {
  const channel = (offset: number) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** The contrast ratio of two colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

export interface ContrastPair {
  readonly foreground: ColorToken;
  readonly background: ColorToken;
  readonly minimum: number;
}

/** Every pair a design must pass. */
export const CONTRAST_PAIRS: readonly ContrastPair[] = Object.freeze([
  { foreground: 'text', background: 'background', minimum: 4.5 },
  { foreground: 'text', background: 'surface', minimum: 4.5 },
  { foreground: 'text', background: 'surfaceRaised', minimum: 4.5 },
  { foreground: 'textMuted', background: 'background', minimum: 4.5 },
  { foreground: 'textMuted', background: 'surface', minimum: 4.5 },
  { foreground: 'onAccent', background: 'accent', minimum: 4.5 },
  { foreground: 'accent', background: 'background', minimum: 3 },
]);

export interface ContrastResult extends ContrastPair {
  /** Rounded to two decimals for display; the pass check uses the exact value. */
  readonly ratio: number;
  readonly passes: boolean;
}

/** Each pair's ratio and verdict. */
export function checkContrast(colors: ThemeTokens['colors']): ContrastResult[] {
  return CONTRAST_PAIRS.map((pair) => {
    const exact = contrastRatio(colors[pair.foreground], colors[pair.background]);
    return { ...pair, ratio: Math.floor(exact * 100) / 100, passes: exact >= pair.minimum };
  });
}
