/**
 * `PublicSiteService` (`public-site-rendering.UT01`, `UT02`) with fake readers.
 */
import { Readable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { publishableContent, RESUME_ASSET } from '../../testing/index.js';
import type { IAssetReader, OpenedAsset } from '../assets/index.js';
import type { ISnapshotReader, StoredSnapshot } from '../publishing/index.js';
import { PublicSiteService } from './public-site.service.js';

const live: StoredSnapshot = {
  id: 'snap-1',
  portfolioId: 'p1',
  version: 3,
  contentHash: 'a'.repeat(64),
  content: publishableContent(),
  note: null,
  publishedAt: new Date('2026-10-21T00:00:00.000Z'),
  publishedBy: 'u1',
  delivery: { status: 'ok', at: null, attempts: 1 },
};

const snapshots: ISnapshotReader = {
  getCurrentForSlug: (slug) => Promise.resolve(slug === 'ada' ? live : null),
  listPublished: () => Promise.resolve([{ slug: 'ada', publishedAt: live.publishedAt }]),
};

const opened: string[] = [];
const assets: IAssetReader = {
  open: (portfolioId, assetId) => {
    opened.push(`${portfolioId}/${assetId}`);
    return Promise.resolve({ asset: { ...RESUME_ASSET, portfolioId, storageKey: 'k', createdAt: new Date() }, stream: Readable.from([]) } as OpenedAsset);
  },
};

const service = new PublicSiteService(snapshots, assets);

describe('PublicSiteService', () => {
  it('public-site-rendering.UT01 — the live content and hash; an unknown or unpublished slug is NOT_FOUND', async () => {
    expect(await service.current('ada')).toEqual({
      slug: 'ada',
      version: 3,
      publishedAt: live.publishedAt,
      contentHash: live.contentHash,
      content: live.content,
    });
    await expect(service.current('nobody')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('public-site-rendering.UT02 — a listed file opens from its own portfolio; unlisted or renamed is NOT_FOUND', async () => {
    await service.asset('ada', RESUME_ASSET.id, RESUME_ASSET.filename);
    expect(opened).toEqual([`p1/${RESUME_ASSET.id}`]);
    await expect(service.asset('ada', 'other', RESUME_ASSET.filename)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.asset('ada', RESUME_ASSET.id, 'renamed.pdf')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(service.asset('nobody', RESUME_ASSET.id, RESUME_ASSET.filename)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(opened).toHaveLength(1);
  });

  it('lists published portfolios', async () => {
    expect(await service.published()).toEqual([{ slug: 'ada', publishedAt: live.publishedAt }]);
  });
});
