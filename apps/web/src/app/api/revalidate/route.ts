/**
 * `POST /api/revalidate` (`public-site-rendering.API03`): the API's publish step calls it; the
 * handler is in `lib/site/revalidate-handler.ts`. `{ expire: 0 }` makes the next request render
 * the new snapshot instead of a stale copy (AC11).
 */
import { revalidateTag } from 'next/cache';

import { loadEnv } from '../../../lib/env';
import { createRevalidateHandler } from '../../../lib/site/revalidate-handler';

export async function POST(request: Request): Promise<Response> {
  const handle = createRevalidateHandler(loadEnv().REVALIDATE_SECRET, (tag) => {
    revalidateTag(tag, { expire: 0 });
  });
  return handle(request);
}
