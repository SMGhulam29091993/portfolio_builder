/**
 * `DEFAULT_DESIGN` — the reference design (`design-theme` spec → Default colours; owner answers of
 * 2026-10-20). Every new portfolio starts from it (ADR-0010 → template: design only), and API03
 * resets to it. It passes `validateDesign`, which the API checks at startup.
 */
import type { DesignSpec } from './schema.js';

export const DEFAULT_DESIGN: DesignSpec = Object.freeze({
  theme: {
    colors: {
      background: '#09090b',
      surface: '#111113',
      surfaceRaised: '#151517',
      border: '#27272a',
      text: '#ededef',
      textMuted: '#a1a1aa',
      accent: '#c0f83c',
      onAccent: '#09090b',
    },
    fonts: { sans: 'inter', display: 'instrument-serif', mono: 'jetbrains-mono' },
    radius: 'xl',
    effects: { glow: true, dotGrid: true, motion: 'subtle' },
  },
  layout: {
    hero: 'split-code-card',
    about: 'bento',
    work: 'featured-grid',
    experience: 'timeline',
    stack: 'chip-groups',
    contact: 'glow-card',
  },
});
