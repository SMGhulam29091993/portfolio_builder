/** `PublishedSource` (`public-site-rendering` AC2, AC11, AC17) with a scripted `fetch`. */
import { describe, expect, it } from 'vitest';

import { portfolioTag, PublishedSource, type FetchFunction } from './published-source';
import { publicPortfolioFixture } from './site-fixtures';

function scripted(...answers: (Response | Error)[]): { fetchFn: FetchFunction; calls: { url: string; init: unknown }[] } {
  const calls: { url: string; init: unknown }[] = [];
  return {
    calls,
    fetchFn: (url, init) => {
      calls.push({ url, init });
      const next = answers.shift() ?? new Error('no answer');
      return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
    },
  };
}

const ok = () => Response.json({ data: publicPortfolioFixture() });

describe('PublishedSource', () => {
  it('fetches by slug with the slug tag and the 300 s fallback', async () => {
    const { fetchFn, calls } = scripted(ok());
    const result = await new PublishedSource('http://api', fetchFn).portfolio('ada');
    expect(result).toMatchObject({ kind: 'published', stale: false, portfolio: { slug: 'ada' } });
    expect(calls[0]).toEqual({ url: 'http://api/api/v1/public/portfolios/ada', init: { next: { tags: [portfolioTag('ada')], revalidate: 300 } } });
  });

  it('public-site-rendering.AC2 — a 404 is not published', async () => {
    const { fetchFn } = scripted(new Response(null, { status: 404 }));
    expect(await new PublishedSource('http://api', fetchFn).portfolio('ada')).toEqual({ kind: 'not-published' });
  });

  it('public-site-rendering.AC17 — unreachable or 5xx serves the last good copy; with none, unavailable', async () => {
    const { fetchFn } = scripted(new Error('down'), ok(), new Error('down'), new Response(null, { status: 503 }), new Response('not json'));
    const source = new PublishedSource('http://api', fetchFn);
    expect(await source.portfolio('ada')).toEqual({ kind: 'unavailable' });
    await source.portfolio('ada');
    expect(await source.portfolio('ada')).toMatchObject({ kind: 'published', stale: true });
    expect(await source.portfolio('ada')).toMatchObject({ kind: 'published', stale: true });
    expect(await source.portfolio('ada')).toMatchObject({ kind: 'published', stale: true });
  });

  it('a 404 forgets the last good copy (unpublished stays unpublished when the API then fails)', async () => {
    const { fetchFn } = scripted(ok(), new Response(null, { status: 404 }), new Error('down'));
    const source = new PublishedSource('http://api', fetchFn);
    await source.portfolio('ada');
    await source.portfolio('ada');
    expect(await source.portfolio('ada')).toEqual({ kind: 'unavailable' });
  });

  it('lists published slugs, or none when the API fails', async () => {
    const list = Response.json({ data: { portfolios: [{ slug: 'ada', publishedAt: '2026-10-21T00:00:00.000Z' }] } });
    const { fetchFn } = scripted(list, new Response(null, { status: 500 }), new Error('down'));
    const source = new PublishedSource('http://api', fetchFn);
    expect(await source.publishedSlugs()).toEqual([{ slug: 'ada', publishedAt: '2026-10-21T00:00:00.000Z' }]);
    expect(await source.publishedSlugs()).toEqual([]);
    expect(await source.publishedSlugs()).toEqual([]);
  });
});
