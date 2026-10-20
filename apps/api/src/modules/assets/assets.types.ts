/**
 * Domain types of the `assets` module (`media-assets` plan → Data Model). Payloads are owned by
 * `packages/contracts` and re-exported here.
 */
import type { Readable } from 'node:stream';

import type { AssetKind } from '@portfolio/contracts';

export {
  ASSET_FILENAME_MAX_LENGTH,
  ASSET_KINDS,
  ASSET_RULES,
  assetIdParamsSchema,
  assetKindSchema,
  listAssetsQuerySchema,
  type AssetKind,
  type AssetReference,
  type ListAssetsQuery,
} from '@portfolio/contracts';

/** One stored file's metadata. Every asset belongs to exactly one portfolio (ADR-0010). */
export interface StoredAsset {
  readonly id: string;
  readonly portfolioId: string;
  readonly kind: AssetKind;
  /** Sanitised base name, at most 100 characters. Never logged. */
  readonly filename: string;
  /** Detected from the bytes, never from the client. */
  readonly mime: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  /** Where `IFileStorage` keeps the bytes; random, so it reveals nothing. */
  readonly storageKey: string;
  readonly createdAt: Date;
}

export type NewAsset = Omit<StoredAsset, 'id' | 'createdAt'>;

/** What `IFileStorage.put` learned while storing. */
export interface StoredBytes {
  readonly sizeBytes: number;
  readonly sha256: string;
}

/** An upload as the controller hands it to the service. */
export interface AssetUpload {
  readonly portfolioId: string;
  readonly kind: AssetKind;
  /** As the client named it; sanitised by the service. */
  readonly filename: string;
  readonly stream: Readable;
}

/** The result of an upload: the asset, and whether this request created it (201 vs 200). */
export interface UploadResult {
  readonly asset: StoredAsset;
  readonly created: boolean;
}

/** An asset's metadata and a stream of its bytes (`media-assets.API04`). */
export interface OpenedAsset {
  readonly asset: StoredAsset;
  readonly stream: Readable;
}
