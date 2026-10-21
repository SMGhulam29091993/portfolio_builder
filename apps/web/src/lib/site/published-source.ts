/**
 * Server-side reads of published portfolios (`public-site-rendering.T02`, `T03`, `T08`; AC1, AC2,
 * AC11, AC17). Each portfolio's fetch carries its own cache tag — the revalidate route refreshes
 * one slug — and a 300-second time-based fallback for when a revalidation call is lost.
 *
 * The last good copy of each portfolio is kept in memory, so when the API is unreachable a
 * visitor gets the last page that rendered rather than an error (AC17). Only an unpublished or
 * unknown slug (the API's 404) forgets it.
 */
import type { PublicPortfolio, PublishedPortfolioList } from '@portfolio/contracts';

/** `/<slug>` re-renders at least this often, even if no revalidation call arrives (AC11). */
export const PORTFOLIO_FALLBACK_SECONDS = 300;

/** The tag of the published list (the sitemap). */
export const PUBLISHED_LIST_TAG = 'portfolios';

/** The cache tag of one portfolio's published content. */
export function portfolioTag(slug: string): string {
  return `portfolio:${slug}`;
}

export type PublishedResult =
  | { readonly kind: 'published'; readonly portfolio: PublicPortfolio; readonly stale: boolean }
  | { readonly kind: 'not-published' }
  | { readonly kind: 'unavailable' };

/** `fetch` as Next.js extends it with cache options; injected so tests need no network. */
export type FetchFunction = (url: string, init: RequestInit & { next?: { tags?: string[]; revalidate?: number } }) => Promise<Response>;

export class PublishedSource {
  private readonly lastGood = new Map<string, PublicPortfolio>();

  constructor(
    private readonly apiBase: string,
    private readonly fetchFn: FetchFunction = fetch,
  ) {}

  async portfolio(slug: string): Promise<PublishedResult> {
    let response: Response;
    try {
      response = await this.fetchFn(`${this.apiBase}/api/v1/public/portfolios/${encodeURIComponent(slug)}`, {
        next: { tags: [portfolioTag(slug)], revalidate: PORTFOLIO_FALLBACK_SECONDS },
      });
    } catch {
      return this.fallback(slug);
    }
    if (response.status === 404) {
      this.lastGood.delete(slug);
      return { kind: 'not-published' };
    }
    if (!response.ok) return this.fallback(slug);
    try {
      const { data } = (await response.json()) as { data: PublicPortfolio };
      this.lastGood.set(slug, data);
      return { kind: 'published', portfolio: data, stale: false };
    } catch {
      return this.fallback(slug);
    }
  }

  /** Every published portfolio's slug; empty when the API cannot be reached (AC9 → Error Handling). */
  async publishedSlugs(): Promise<PublishedPortfolioList['portfolios']> {
    try {
      const response = await this.fetchFn(`${this.apiBase}/api/v1/public/portfolios`, {
        next: { tags: [PUBLISHED_LIST_TAG], revalidate: PORTFOLIO_FALLBACK_SECONDS },
      });
      if (!response.ok) return [];
      return ((await response.json()) as { data: PublishedPortfolioList }).data.portfolios;
    } catch {
      return [];
    }
  }

  private fallback(slug: string): PublishedResult {
    const last = this.lastGood.get(slug);
    return last ? { kind: 'published', portfolio: last, stale: true } : { kind: 'unavailable' };
  }
}
