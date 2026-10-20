/**
 * `SiteRevalidationListener` (`publish-pipeline.UT10`; AC12).
 */
import { describe, expect, it } from 'vitest';

import { InMemorySnapshotRepository, ManualClock, publishableContent, RecordingLogger } from '../../../testing/index.js';
import type { IRevalidationClient } from '../publishing.interface.js';
import { SiteRevalidationListener } from './site-revalidation.listener.js';

async function setup(client: IRevalidationClient) {
  const snapshots = new InMemorySnapshotRepository();
  const stored = await snapshots.insert({
    portfolioId: 'p1',
    version: 1,
    contentHash: 'a'.repeat(64),
    content: publishableContent(),
    note: null,
    publishedAt: new Date('2026-10-21T00:00:00.000Z'),
    publishedBy: 'u1',
  });
  const logger = new RecordingLogger();
  const clock = new ManualClock(new Date('2026-10-21T01:00:00.000Z'));
  const listener = new SiteRevalidationListener(client, snapshots, clock, logger);
  const event = {
    name: 'portfolio.published' as const,
    payload: { portfolioId: 'p1', slug: 'ada', snapshotId: stored.id, version: 1 },
    meta: { requestId: 'req-9' },
    occurredAt: clock.now(),
  };
  return { snapshots, stored, logger, listener, event };
}

describe('publish-pipeline.UT10 — SiteRevalidationListener', () => {
  it('records ok with the time', async () => {
    const slugs: string[] = [];
    const { snapshots, stored, listener, event } = await setup({ revalidate: (slug) => (slugs.push(slug), Promise.resolve('ok')) });
    await listener.handle(event);
    expect(slugs).toEqual(['ada']);
    expect((await snapshots.findById('p1', stored.id))?.delivery).toEqual({ status: 'ok', at: new Date('2026-10-21T01:00:00.000Z'), attempts: 1 });
  });

  it('records failed and logs it with the request id', async () => {
    const { snapshots, stored, logger, listener, event } = await setup({ revalidate: () => Promise.resolve('failed') });
    await listener.handle(event);
    expect((await snapshots.findById('p1', stored.id))?.delivery.status).toBe('failed');
    expect(logger.entries).toContainEqual(expect.objectContaining({ message: 'site revalidation failed' }));
  });

  it('never throws when the client throws', async () => {
    const { snapshots, stored, logger, listener, event } = await setup({ revalidate: () => Promise.reject(new Error('down')) });
    await expect(listener.handle(event)).resolves.toBeUndefined();
    expect((await snapshots.findById('p1', stored.id))?.delivery.status).toBe('pending');
    expect(logger.entries.some((entry) => entry.message === 'recording site revalidation failed')).toBe(true);
  });
});
