/**
 * Asset payloads and limits (`media-assets` spec → Asset reference; `media-assets.T01`).
 * Canonical owner of the kinds, accepted types and size caps: the API enforces them and the
 * CMS upload screen explains them from the same constants.
 */
import { z } from 'zod';

export const ASSET_KINDS = ['resume', 'image'] as const;
export const assetKindSchema = z.enum(ASSET_KINDS);
export type AssetKind = z.infer<typeof assetKindSchema>;

/** Accepted content types (detected from the bytes) and the size cap per kind. */
export const ASSET_RULES: Readonly<Record<AssetKind, { readonly mime: readonly string[]; readonly maxBytes: number }>> =
  Object.freeze({
    resume: { mime: ['application/pdf'], maxBytes: 5 * 1024 * 1024 },
    image: { mime: ['image/png', 'image/jpeg', 'image/webp'], maxBytes: 2 * 1024 * 1024 },
  });

/** Longest stored filename. */
export const ASSET_FILENAME_MAX_LENGTH = 100;

/** An asset as every response shows it. `inUse` only on list and upload answers. */
export const assetReferenceSchema = z.object({
  id: z.string(),
  kind: assetKindSchema,
  filename: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().positive(),
  sha256: z.string(),
  createdAt: z.string(),
  inUse: z.boolean(),
});
export type AssetReference = z.infer<typeof assetReferenceSchema>;

/** `media-assets.API02` — query. */
export const listAssetsQuerySchema = z.object({ kind: assetKindSchema.optional() });
/** `media-assets.API03`, `API04` — params. */
export const assetIdParamsSchema = z.object({ id: z.string().min(1).max(64) });

export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
