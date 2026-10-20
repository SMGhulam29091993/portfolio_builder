/**
 * The font allow-list (`design-theme` spec → Font allow-list; owner answer 2026-10-20). Each id
 * belongs to one role and maps to a `next/font/google` loader in the web app; no font URL is ever
 * taken from stored data. The first font of each role is the reference default.
 */
export const FONT_ROLES = ['sans', 'display', 'mono'] as const;
export type FontRole = (typeof FONT_ROLES)[number];

export interface FontInfo {
  readonly id: string;
  readonly label: string;
  readonly role: FontRole;
}

export const FONT_ALLOW_LIST: readonly FontInfo[] = Object.freeze([
  { id: 'inter', label: 'Inter', role: 'sans' },
  { id: 'manrope', label: 'Manrope', role: 'sans' },
  { id: 'space-grotesk', label: 'Space Grotesk', role: 'sans' },
  { id: 'instrument-serif', label: 'Instrument Serif', role: 'display' },
  { id: 'playfair-display', label: 'Playfair Display', role: 'display' },
  { id: 'fraunces', label: 'Fraunces', role: 'display' },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', role: 'mono' },
  { id: 'ibm-plex-mono', label: 'IBM Plex Mono', role: 'mono' },
  { id: 'fira-code', label: 'Fira Code', role: 'mono' },
]);

/** The role of `fontId`, or `undefined` when it is not on the allow-list. */
export function fontRole(fontId: string): FontRole | undefined {
  return FONT_ALLOW_LIST.find((font) => font.id === fontId)?.role;
}
