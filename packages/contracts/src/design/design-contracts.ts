/**
 * Envelopes of `design-theme.API02` and `API03`. The design itself (`theme`, `layout`) is owned
 * by `packages/design-tokens` and validated in full by the API's `IDesignValidator`, so every
 * problem — shape, catalogue and contrast — is reported together with its path.
 */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';

/** `design-theme.API02` — body; `theme` and `layout` are checked by the design validator. */
export const updateDesignRequestSchema = z.object({
  expectedRevision: z.number().int().min(0),
  theme: z.unknown(),
  layout: z.unknown(),
});

/** `design-theme.API03` — body. */
export const resetDesignRequestSchema = z.object({ expectedRevision: z.number().int().min(0) });

export type UpdateDesignRequest = z.infer<typeof updateDesignRequestSchema>;
export type ResetDesignRequest = z.infer<typeof resetDesignRequestSchema>;

/** Most custom layouts one portfolio's library holds (`design-library` → Data). */
export const LAYOUT_LIBRARY_MAX = 50;
/** Most design presets one portfolio holds. */
export const PRESET_LIBRARY_MAX = 20;
/** Longest layout or preset name. */
export const LIBRARY_NAME_MAX_LENGTH = 60;

/** `design-library.API04` — body; the current draft design is saved under `name`. */
export const savePresetRequestSchema = z.object({ name: plainText(LIBRARY_NAME_MAX_LENGTH) });

/** `design-library.API05` — body. */
export const applyPresetRequestSchema = z.object({ expectedRevision: z.number().int().min(0) });

/** `design-library.API02`, `API05`, `API06` — params. */
export const libraryIdParamsSchema = z.object({ id: z.string().regex(/^[0-9a-f]{24}$/) });

export type SavePresetRequest = z.infer<typeof savePresetRequestSchema>;
export type ApplyPresetRequest = z.infer<typeof applyPresetRequestSchema>;

/** Where a library layout came from. */
export type LibraryLayoutSource = 'ai' | 'preset';

/** `design-library.API01` — one library layout; `layout` is a `CustomLayout` (design-tokens). */
export interface LibraryLayout {
  readonly id: string;
  readonly section: string;
  readonly name: string;
  readonly layout: unknown;
  readonly source: LibraryLayoutSource;
  readonly createdAt: string;
}

/** `design-library.API03` — one preset; `design` is a `DesignSpec` (design-tokens). */
export interface DesignPreset {
  readonly id: string;
  readonly name: string;
  readonly design: { readonly theme: unknown; readonly layout: Readonly<Record<string, string>> };
  readonly createdAt: string;
}
