/**
 * The one `PublishedSource` per server process, and a request-scoped reader so the page and its
 * metadata share one fetch. A slug that cannot be a portfolio's never reaches the API.
 */
import { isPortfolioSlug } from '@portfolio/contracts';
import { cache } from 'react';

import { loadEnv } from '../env';
import { PublishedSource, type PublishedResult } from './published-source';

let source: PublishedSource | undefined;

/** Created on first use, not at import, so building a page needs no runtime environment. */
export function publishedSource(): PublishedSource {
  source ??= new PublishedSource(loadEnv().API_INTERNAL_URL);
  return source;
}

export const readPublished = cache(async (slug: string): Promise<PublishedResult> => {
  if (!isPortfolioSlug(slug)) return { kind: 'not-published' };
  return publishedSource().portfolio(slug);
});
