/**
 * `IPublicSiteService` (`public-site-rendering.T01`; AC12, AC13): the live snapshot of a
 * portfolio and the files it lists. An unknown slug and an unpublished portfolio fail the same
 * way, so the public API does not reveal which slugs exist. A file is served only when the live
 * snapshot lists it under that exact name — an uploaded-but-unpublished or replaced file is 404.
 */
import { NotFoundError } from '../../core/errors/index.js';
import type { IAssetReader, OpenedAsset } from '../assets/index.js';
import type { ISnapshotReader, PublishedPortfolio } from '../publishing/index.js';
import type { IPublicSiteService } from './public-site.interface.js';
import type { CurrentPortfolio } from './public-site.types.js';

export class PublicSiteService implements IPublicSiteService {
  constructor(
    private readonly snapshots: ISnapshotReader,
    private readonly assets: IAssetReader,
  ) {}

  async current(slug: string): Promise<CurrentPortfolio> {
    const snapshot = await this.snapshots.getCurrentForSlug(slug);
    if (!snapshot) throw new NotFoundError('Nothing is published here');
    return {
      slug,
      version: snapshot.version,
      publishedAt: snapshot.publishedAt,
      contentHash: snapshot.contentHash,
      content: snapshot.content,
    };
  }

  async asset(slug: string, assetId: string, filename: string): Promise<OpenedAsset> {
    const snapshot = await this.snapshots.getCurrentForSlug(slug);
    const listed = snapshot?.content.assets.find((asset) => asset.id === assetId);
    if (!snapshot || listed?.filename !== filename) throw new NotFoundError('File not found');
    return this.assets.open(snapshot.portfolioId, assetId);
  }

  published(): Promise<PublishedPortfolio[]> {
    return this.snapshots.listPublished();
  }
}
