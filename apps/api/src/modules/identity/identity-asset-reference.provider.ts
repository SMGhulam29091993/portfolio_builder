/**
 * Tells `assets` whether the draft identity uses an asset (`site-identity.T05`; AC8):
 * `IAssetReferenceProvider` is owned by `assets` and implemented here, so `assets` imports
 * nothing from `identity` (Dependency Inversion).
 */
import type { IAssetReferenceProvider } from '../assets/index.js';
import type { IIdentityRepository } from './identity.interface.js';

export class IdentityAssetReferenceProvider implements IAssetReferenceProvider {
  readonly label = 'draft identity';

  constructor(private readonly identities: IIdentityRepository) {}

  async referencesAsset(assetId: string, portfolioId: string): Promise<boolean> {
    const stored = await this.identities.find(portfolioId);
    if (!stored) return false;
    return stored.data.resume.assetId === assetId || stored.data.seo.ogImageAssetId === assetId;
  }
}
