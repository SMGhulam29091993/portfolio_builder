/**
 * `ThemeTokens` and `DesignSpec` (`design-theme` spec → Design payload; canonical owner). The
 * shape is checked here; catalogue membership and contrast are checked by `validateDesign`, so
 * every problem is reported at once with its path.
 */
import { z } from 'zod';

import { SECTION_TYPES } from './catalogue.js';

/** A 6-digit hex colour; upper-case input is normalised to lower case (Edge Cases). */
export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour, e.g. #c0f83c')
  .transform((value) => value.toLowerCase());

export const COLOR_TOKENS = ['background', 'surface', 'surfaceRaised', 'border', 'text', 'textMuted', 'accent', 'onAccent'] as const;
export type ColorToken = (typeof COLOR_TOKENS)[number];

export const RADII = ['none', 'sm', 'md', 'lg', 'xl'] as const;
export const MOTIONS = ['none', 'subtle', 'full'] as const;

const fontIdSchema = z.string().min(1).max(32);
const variantIdSchema = z.string().min(1).max(32);

export const themeTokensSchema = z.object({
  colors: z.object(Object.fromEntries(COLOR_TOKENS.map((token) => [token, hexColorSchema])) as Record<ColorToken, typeof hexColorSchema>),
  fonts: z.object({ sans: fontIdSchema, display: fontIdSchema, mono: fontIdSchema }),
  radius: z.enum(RADII),
  effects: z.object({ glow: z.boolean(), dotGrid: z.boolean(), motion: z.enum(MOTIONS) }),
});

export const layoutSchema = z.object(
  Object.fromEntries(SECTION_TYPES.map((type) => [type, variantIdSchema])) as Record<(typeof SECTION_TYPES)[number], typeof variantIdSchema>,
);

export const designSpecSchema = z.object({ theme: themeTokensSchema, layout: layoutSchema });

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type DesignLayout = z.infer<typeof layoutSchema>;
export type DesignSpec = z.infer<typeof designSpecSchema>;
export type Radius = (typeof RADII)[number];
export type Motion = (typeof MOTIONS)[number];
