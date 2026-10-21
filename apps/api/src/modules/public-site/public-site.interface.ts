/**
 * Contracts of the `public-site` module. It reads published data only: `ISnapshotReader` from
 * `publishing` and `IAssetReader` from `assets` — never a draft (`public-site-rendering.AC12`,
 * enforced by the architecture test).
 */
import type { OpenedAsset } from '../assets/index.js';
import type { PublishedPortfolio } from '../publishing/index.js';
import type { CurrentPortfolio } from './public-site.types.js';

/** `public-site-rendering.API01`, `API02`, `API04`. */
export interface IPublicSiteService {
  /** @throws {NotFoundError} Unknown slug, or nothing published (one answer for both). */
  current(slug: string): Promise<CurrentPortfolio>;
  /**
   * A file of the live snapshot only (`public-site-rendering.AC13`).
   *
   * @throws {NotFoundError} Not in the live snapshot's `assets`, or the filename differs.
   */
  asset(slug: string, assetId: string, filename: string): Promise<OpenedAsset>;
  /** Every published portfolio, by slug. */
  published(): Promise<PublishedPortfolio[]>;
}
