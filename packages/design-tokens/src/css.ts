/**
 * `toCssVariables` (`design-theme.AC7`): one CSS custom property per token, in a fixed order, so
 * the same theme always yields byte-identical output. Fonts are emitted as references to the
 * `next/font` variables the web app defines per allowed font (`--font-<id>`), never as a
 * family name or URL from stored data.
 */
import { COLOR_TOKENS, type Radius, type ThemeTokens } from './schema.js';

/** The radius scale behind the `radius` token. */
export const RADIUS_VALUES: Readonly<Record<Radius, string>> = Object.freeze({
  none: '0px',
  sm: '6px',
  md: '12px',
  lg: '18px',
  xl: '24px',
});

const kebab = (token: string) => token.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** `[name, value]` pairs in emission order. */
export function cssVariableEntries(theme: ThemeTokens): [string, string][] {
  return [
    ...COLOR_TOKENS.map((token): [string, string] => [`--color-${kebab(token)}`, theme.colors[token]]),
    ['--font-sans', `var(--font-${theme.fonts.sans})`],
    ['--font-display', `var(--font-${theme.fonts.display})`],
    ['--font-mono', `var(--font-${theme.fonts.mono})`],
    ['--radius', RADIUS_VALUES[theme.radius]],
    ['--effect-glow', theme.effects.glow ? '1' : '0'],
    ['--effect-dot-grid', theme.effects.dotGrid ? '1' : '0'],
  ];
}

/** `--name: value;` declarations, one per line. */
export function toCssVariables(theme: ThemeTokens): string {
  return cssVariableEntries(theme)
    .map(([name, value]) => `${name}: ${value};`)
    .join('\n');
}
