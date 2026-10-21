/**
 * `POST /api/revalidate` (`public-site-rendering.API03`, `T03`; AC11, UT08): the API calls it
 * after every pointer switch with the shared secret and the slug. The secret is checked first,
 * in constant time, and a wrong or missing one is the only failure an outsider can see (401).
 * Then the one portfolio's tag — and the published list, for the sitemap — are expired so the
 * next request renders the new snapshot.
 */
import { createHash, timingSafeEqual } from 'node:crypto';

import { slugSchema } from '@portfolio/contracts';
import { z } from 'zod';

import { portfolioTag, PUBLISHED_LIST_TAG } from './published-source';

const bodySchema = z.object({ slug: slugSchema });

/** Equal-length digests, so the comparison takes the same time whatever was sent. */
function sameSecret(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(given), digest(expected));
}

export function createRevalidateHandler(secret: string | undefined, expire: (tag: string) => void) {
  return async (request: Request): Promise<Response> => {
    const given = request.headers.get('x-revalidate-secret');
    if (!secret || !given || !sameSecret(given, secret)) {
      return Response.json({ revalidated: false }, { status: 401 });
    }
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return Response.json({ revalidated: false }, { status: 400 });
    expire(portfolioTag(parsed.data.slug));
    expire(PUBLISHED_LIST_TAG);
    return Response.json({ revalidated: true });
  };
}
