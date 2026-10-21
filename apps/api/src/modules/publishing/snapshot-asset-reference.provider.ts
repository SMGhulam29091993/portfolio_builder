/**
 * Tells `assets` whether any snapshot uses an asset (`publish-pipeline.T08`; AC18): a file in a
 * published version cannot be deleted while that version could be made live again.
 * `IAssetReferenceProvider` is owned by `assets` and implemented here (Dependency Inversion).
 */
import type { IAssetReferenceProvider } from '../assets/index.js';
import type { ISnapshotRepository } from './publishing.interface.js';

export class SnapshotAssetReferenceProvider implements IAssetReferenceProvider {
  readonly label = 'published snapshots';

  constructor(private readonly snapshots: Pick<ISnapshotRepository, 'referencesAsset'>) {}

  referencesAsset(assetId: string, portfolioId: string): Promise<boolean> {
    return this.snapshots.referencesAsset(portfolioId, assetId);
  }
}
