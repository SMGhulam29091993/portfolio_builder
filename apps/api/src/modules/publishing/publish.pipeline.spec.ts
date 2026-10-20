/**
 * `PublishPipeline` (`publish-pipeline.UT07`, `UT08`).
 */
import { describe, expect, it } from 'vitest';

import { publishableContent } from '../../testing/index.js';
import { PublishPipeline } from './publish.pipeline.js';
import type { IPublishStep } from './publishing.interface.js';
import type { PublishContext } from './publishing.types.js';

const context: PublishContext = {
  scope: { portfolioId: 'p1', userId: 'u1' },
  slug: 'ada',
  content: publishableContent(),
  contentHash: 'a'.repeat(64),
  note: null,
  previous: null,
  meta: {},
};

/** Records its name and adds it to `note`, so the order is visible in the result. */
function recordingStep(name: string, ran: string[]): IPublishStep {
  return {
    run: (received) => {
      ran.push(name);
      return Promise.resolve({ ...received, note: `${received.note ?? ''}${name}` });
    },
  };
}

describe('PublishPipeline', () => {
  it('publish-pipeline.UT07 — runs the steps in order, passing each result to the next', async () => {
    const ran: string[] = [];
    const result = await new PublishPipeline([recordingStep('a', ran), recordingStep('b', ran), recordingStep('c', ran)]).run(context);
    expect(ran).toEqual(['a', 'b', 'c']);
    expect(result.note).toBe('abc');
    expect(result.scope).toEqual(context.scope);
  });

  it('publish-pipeline.UT08 — a throwing step stops every later step', async () => {
    const ran: string[] = [];
    const failing: IPublishStep = { run: () => Promise.reject(new Error('blocked')) };
    await expect(new PublishPipeline([recordingStep('a', ran), failing, recordingStep('c', ran)]).run(context)).rejects.toThrow('blocked');
    expect(ran).toEqual(['a']);
  });
});
