/**
 * Envelopes of `design-theme.API02` and `API03`. The design itself (`theme`, `layout`) is owned
 * by `packages/design-tokens` and validated in full by the API's `IDesignValidator`, so every
 * problem — shape, catalogue and contrast — is reported together with its path.
 */
import { z } from 'zod';

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
