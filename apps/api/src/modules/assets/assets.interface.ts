/**
 * Contracts of the `assets` module, owned on the consuming side (`media-assets` plan →
 * Architecture Approach). `IAssetReferenceProvider` is owned here and implemented by the
 * modules that reference assets (`identity`, `publishing`), so `assets` imports neither.
 */
import type { Readable } from 'node:stream';

import type {
  AssetKind,
  AssetUpload,
  NewAsset,
  OpenedAsset,
  StoredAsset,
  StoredBytes,
  UploadResult,
} from './assets.types.js';

/** The `assets` collection. Every method is scoped by `portfolioId` (tenant isolation). */
export interface IAssetRepository {
  /** @throws {ConflictError} `ASSET_EXISTS` — same `sha256` and kind in this portfolio. */
  create(asset: NewAsset): Promise<StoredAsset>;
  findById(portfolioId: string, id: string): Promise<StoredAsset | null>;
  findByHash(portfolioId: string, sha256: string, kind: AssetKind): Promise<StoredAsset | null>;
  /** Newest first. */
  list(portfolioId: string, kind?: AssetKind): Promise<StoredAsset[]>;
  /** @returns `false` when nothing was deleted. */
  delete(portfolioId: string, id: string): Promise<boolean>;
}

/** Where bytes live (`media-assets.AC12`). GridFS today; another store is a new adapter + ADR. */
export interface IFileStorage {
  /** Stores the stream under `key`, returning its size and SHA-256. */
  put(key: string, source: Readable): Promise<StoredBytes>;
  /** @throws {NotFoundError} No object under `key`. */
  get(key: string): Promise<Readable>;
  /** Idempotent: a missing key is not an error. */
  delete(key: string): Promise<void>;
}

/** Recognises a file's type from its first bytes (`media-assets.UT01`). */
export interface IContentTypeDetector {
  /** The MIME type, or `undefined` when the bytes are not a recognised type. */
  detect(head: Buffer): string | undefined;
}

/**
 * Tells `assets` whether an asset is in use (`media-assets.AC9`). Implemented by each module
 * that stores asset ids; injected as a list by the container.
 */
export interface IAssetReferenceProvider {
  /** Where the reference lives, shown to the user: "draft identity", "published snapshots". */
  readonly label: string;
  referencesAsset(assetId: string, portfolioId: string): Promise<boolean>;
}

/** Existence and kind, for modules validating an asset id (`site-identity.AC5`). */
export interface IAssetLookup {
  kindOf(portfolioId: string, assetId: string): Promise<AssetKind | null>;
}

/** Metadata and bytes, for modules that deliver files (`public-site-rendering`). */
export interface IAssetReader {
  /** @throws {NotFoundError} Unknown in this portfolio, or the bytes are gone. */
  open(portfolioId: string, assetId: string): Promise<OpenedAsset>;
}

/** Upload, list and delete (`media-assets.API01`–`API04`). */
export interface IAssetService extends IAssetReader {
  /**
   * @throws {ValidationError} Empty file.
   * @throws {UnsupportedMediaTypeError} Detected type not allowed for the kind (415).
   * @throws {PayloadTooLargeError} Over the kind's limit (413).
   */
  upload(upload: AssetUpload): Promise<UploadResult>;
  list(portfolioId: string, kind?: AssetKind): Promise<{ asset: StoredAsset; inUse: boolean }[]>;
  /** In-use state of one asset. */
  inUse(portfolioId: string, assetId: string): Promise<boolean>;
  /**
   * @throws {NotFoundError} Unknown in this portfolio.
   * @throws {ConflictError} `ASSET_IN_USE` with `usedBy`.
   */
  delete(portfolioId: string, assetId: string): Promise<void>;
}
