/**
 * `ThemeRoot` (`design-theme.T06`; AC7, AC9): applies a design's tokens to everything inside it
 * as CSS custom properties, set through React's `style` — never injected markup. Renderers then
 * use utilities that read those variables (`bg-background`, `text-accent`, `font-display`,
 * `rounded-[var(--radius)]`), so a design changes the page without changing a component.
 *
 * Motion is gated here for the whole subtree: `data-motion` carries the theme's setting and
 * the global stylesheet stops every animation and transition under `data-motion="none"` and
 * under `prefers-reduced-motion: reduce` (AC9).
 */
import { cssVariableEntries, type ThemeTokens } from '@portfolio/design-tokens';
import type { CSSProperties, ReactNode } from 'react';

export interface ThemeRootProps {
  readonly theme: ThemeTokens;
  readonly children: ReactNode;
  readonly className?: string;
}

/** The theme's custom properties as a React style object. */
export function themeStyle(theme: ThemeTokens): CSSProperties {
  return Object.fromEntries(cssVariableEntries(theme));
}

export function ThemeRoot({ theme, children, className }: ThemeRootProps) {
  return (
    <div
      data-theme-root=""
      data-motion={theme.effects.motion}
      data-glow={theme.effects.glow ? 'on' : 'off'}
      data-dot-grid={theme.effects.dotGrid ? 'on' : 'off'}
      style={themeStyle(theme)}
      className={`bg-background font-sans text-text ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
