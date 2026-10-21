/** The revalidate route (`public-site-rendering.UT08`; AC11). */
import { describe, expect, it } from 'vitest';

import { createRevalidateHandler } from './revalidate-handler';

const SECRET = 'a-shared-revalidation-secret-0000000000';

function post(headers: Record<string, string>, body: unknown): Request {
  return new Request('http://web/api/revalidate', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}

describe('revalidate handler', () => {
  it('the right secret and a slug: 200, and the slug and list tags expire', async () => {
    const expired: string[] = [];
    const response = await createRevalidateHandler(SECRET, (tag) => expired.push(tag))(post({ 'x-revalidate-secret': SECRET }, { slug: 'ada' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ revalidated: true });
    expect(expired).toEqual(['portfolio:ada', 'portfolios']);
  });

  it.each([
    ['a wrong secret', { 'x-revalidate-secret': `${SECRET}x` }, SECRET],
    ['a missing secret', {}, SECRET],
    ['no configured secret', { 'x-revalidate-secret': SECRET }, undefined],
  ])('%s: 401 and nothing expires', async (_label, headers, configured) => {
    const expired: string[] = [];
    const response = await createRevalidateHandler(configured, (tag) => expired.push(tag))(post(headers, { slug: 'ada' }));
    expect(response.status).toBe(401);
    expect(expired).toEqual([]);
  });

  it('the right secret without a valid slug: 400', async () => {
    const handle = createRevalidateHandler(SECRET, () => undefined);
    expect((await handle(post({ 'x-revalidate-secret': SECRET }, {}))).status).toBe(400);
    expect((await handle(post({ 'x-revalidate-secret': SECRET }, { slug: 'Bad Slug' }))).status).toBe(400);
  });
});
