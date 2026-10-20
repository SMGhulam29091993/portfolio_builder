/**
 * The anonymous public API (`public-site-rendering` → API01, API02, API04): a portfolio's live
 * snapshot by slug, its files, and the list of published slugs for the sitemap.
 */
import { z } from 'zod';

import { ASSET_FILENAME_MAX_LENGTH } from '../assets/assets-contracts.js';
import { RESERVED_SLUGS, slugSchema } from '../sections/engine.js';
import type { PublishedContent } from './publishing-contracts.js';

/** `public-site-rendering.API01` — params. */
export const publicPortfolioParamsSchema = z.object({ slug: slugSchema });

/** `public-site-rendering.API02` — params. */
export const publicAssetParamsSchema = z.object({
  slug: slugSchema,
  id: z.string().min(1).max(64),
  filename: z.string().min(1).max(ASSET_FILENAME_MAX_LENGTH),
});

/** Whether `value` can be a portfolio's path: the slug shape, and not one of the platform's own. */
export function isPortfolioSlug(value: string): boolean {
  return slugSchema.safeParse(value).success && !RESERVED_SLUGS.includes(value);
}

/** `public-site-rendering.API01` — data. */
export interface PublicPortfolio {
  readonly slug: string;
  readonly version: number;
  readonly publishedAt: string;
  readonly content: PublishedContent;
}

/** `public-site-rendering.API04` — data. */
export interface PublishedPortfolioList {
  readonly portfolios: readonly { readonly slug: string; readonly publishedAt: string }[];
}

/** The public URL of a published file (`public-site-rendering.API02`; canonical owner). */
export function publicAssetPath(slug: string, asset: { readonly id: string; readonly filename: string }): string {
  return `/api/v1/public/portfolios/${encodeURIComponent(slug)}/assets/${encodeURIComponent(asset.id)}/${encodeURIComponent(asset.filename)}`;
}
