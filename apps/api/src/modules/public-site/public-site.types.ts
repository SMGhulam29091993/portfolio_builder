/**
 * Domain types of the `public-site` module (`public-site-rendering`). Request shapes are owned by
 * `packages/contracts`; published content by `publishing`.
 */
import type { PublishedContent } from '../publishing/index.js';

export {
  publicAssetParamsSchema,
  publicPortfolioParamsSchema,
  type PublicPortfolio,
  type PublishedPortfolioList,
} from '@portfolio/contracts';

/** A portfolio's live snapshot as the public API serves it, with the hash its ETag carries. */
export interface CurrentPortfolio {
  readonly slug: string;
  readonly version: number;
  readonly publishedAt: Date;
  readonly contentHash: string;
  readonly content: PublishedContent;
}
