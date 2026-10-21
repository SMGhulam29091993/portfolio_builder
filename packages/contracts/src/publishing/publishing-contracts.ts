/**
 * Publishing payloads (`publish-pipeline` spec → Published content, API Contract). The
 * published content is what `/api/v1/public` serves and what the site renders; it never changes
 * after insert (ADR-0004).
 */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import { identitySchema } from '../identity/identity-contracts.js';
import { assetKindSchema } from '../assets/assets-contracts.js';

/** The current shape's version; any change to it bumps this (`constitution.md` → Versioning). */
/**
 * Version 2 (`design-library`, ADR-0014) adds `design.customLayouts`: a copy of each custom layout
 * the published design names. Version-1 snapshots have none and still render.
 */
export const SNAPSHOT_SCHEMA_VERSION = 2;

export const publishedAssetSchema = z.object({
  id: z.string(),
  kind: assetKindSchema,
  filename: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int().positive(),
  sha256: z.string(),
});

/** Section `data` is each type's own payload, validated when it was saved. */
export const publishedContentSchema = z.object({
  schemaVersion: z.number().int().min(1),
  identity: identitySchema,
  sections: z.array(z.object({ type: z.string(), data: z.unknown() })),
  design: z.object({
    theme: z.unknown(),
    layout: z.record(z.string(), z.string()),
    /** Version 2: a `CustomLayout` per section that uses one. */
    customLayouts: z.record(z.string(), z.unknown()).optional(),
  }),
  assets: z.array(publishedAssetSchema),
});

export const publishIssueSchema = z.object({
  rule: z.string(),
  severity: z.enum(['error', 'warning']),
  path: z.string(),
  message: z.string(),
});

export const revalidationStatusSchema = z.enum(['ok', 'failed', 'pending']);

/** `publish-pipeline.API03` — body. */
export const publishRequestSchema = z.object({
  expectedDraftHash: z.string().regex(/^[0-9a-f]{64}$/),
  note: plainText(200, { min: 0 }).optional(),
});

/** `publish-pipeline.API04` — query. */
export const listSnapshotsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  /** The version to continue below (exclusive). */
  cursor: z.coerce.number().int().min(1).optional(),
});

/** `publish-pipeline.API05` — params. */
export const snapshotVersionParamsSchema = z.object({ version: z.coerce.number().int().min(1) });

export type PublishedAsset = z.infer<typeof publishedAssetSchema>;
export type PublishedContent = z.infer<typeof publishedContentSchema>;
export type PublishIssue = z.infer<typeof publishIssueSchema>;
export type RevalidationStatus = z.infer<typeof revalidationStatusSchema>;
export type PublishRequest = z.infer<typeof publishRequestSchema>;
export type ListSnapshotsQuery = z.infer<typeof listSnapshotsQuerySchema>;

/** `publish-pipeline.API01` — data. */
export interface PublishingStatus {
  readonly published: { readonly version: number; readonly publishedAt: string; readonly contentHash: string } | null;
  readonly draft: { readonly contentHash: string };
  readonly hasUnpublishedChanges: boolean;
  readonly revalidation: { readonly status: RevalidationStatus; readonly at: string } | null;
}

/** One row of `publish-pipeline.API04`. */
export interface SnapshotSummary {
  readonly version: number;
  readonly publishedAt: string;
  readonly note: string | null;
  readonly contentHash: string;
  readonly isCurrent: boolean;
  readonly revalidation: RevalidationStatus;
}
