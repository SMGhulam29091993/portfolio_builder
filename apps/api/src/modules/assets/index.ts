/**
 * Public surface of the `assets` module: interfaces and types only. Other modules validate ids
 * through `IAssetLookup`, read bytes through `IAssetReader`, and report references by
 * implementing `IAssetReferenceProvider`.
 */
export type {
  IAssetLookup,
  IAssetReader,
  IAssetReferenceProvider,
  IAssetRepository,
  IFileStorage,
} from './assets.interface.js';
export type { AssetKind, OpenedAsset, StoredAsset, StoredBytes } from './assets.types.js';
