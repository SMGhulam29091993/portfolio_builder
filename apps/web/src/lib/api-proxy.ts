/**
 * Same-origin proxy from the web app to `apps/api` (`monorepo-foundation.AC12`).
 *
 * The browser only ever calls `/api/v1/**` on the web origin, so the API's auth cookies stay
 * first-party (`int-standards.nextjs.md` → API access). Next.js forwards each request, with its
 * method, query string and body, to the same path on `API_INTERNAL_URL`.
 */

/** Versioned API prefix shared by both apps (`constitution.md` → Versioning Rules). */
const API_PREFIX = '/api/v1';

/** One Next.js rewrite, in the shape `next.config.ts` → `rewrites()` returns. */
export interface ApiRewrite {
  readonly source: string;
  readonly destination: string;
}

/**
 * Builds the rewrite list that proxies `/api/v1/:path*` to the API.
 *
 * @param apiInternalUrl - The validated `API_INTERNAL_URL`. Any path prefix on it is kept, so the
 *   API may sit behind a sub-path; trailing slashes are dropped to avoid a `//` in the target.
 */
export function createApiRewrites(apiInternalUrl: string): ApiRewrite[] {
  const base = apiInternalUrl.replace(/\/+$/, '');
  return [{ source: `${API_PREFIX}/:path*`, destination: `${base}${API_PREFIX}/:path*` }];
}
