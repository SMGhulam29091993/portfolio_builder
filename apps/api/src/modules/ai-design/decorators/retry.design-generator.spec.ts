/**
 * `RetryDesignGenerator` (`ai-design-studio.T05`; UT10; AC6) on a manual timeline.
 */
import { describe, expect, it } from 'vitest';

import { UpstreamError } from '../../../core/errors/index.js';
import { ManualDelay, ScriptedDesignGenerator, type ScriptedAnswer } from '../../../testing/index.js';
import { ProviderRejectedError } from '../ai-design.errors.js';
import type { GenerationRequest } from '../ai-design.types.js';
import { RetryDesignGenerator } from './retry.design-generator.js';

const request: GenerationRequest = { instructions: 'x', messages: [], schema: {}, schemaName: 'design_proposal' };
const policy = { attempts: 3, baseDelayMs: 500 };

function setup(answers: ScriptedAnswer[]) {
  const inner = new ScriptedDesignGenerator(answers, 'openrouter');
  const delay = new ManualDelay();
  return { inner, delay, retry: new RetryDesignGenerator(inner, delay, policy) };
}

/** Runs the call to the end, advancing time well past every backoff the policy allows. */
async function settle(promise: Promise<unknown>, delay: ManualDelay): Promise<unknown> {
  const outcome = promise.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  for (let step = 0; step < policy.attempts; step += 1) await delay.advance(10_000);
  return outcome;
}

describe('RetryDesignGenerator', () => {
  it('ai-design-studio.UT10 / AC6 — a transient failure then success succeeds, after a backoff', async () => {
    const { inner, delay, retry } = setup([new UpstreamError('openrouter'), '{"ok":true}']);
    await expect(settle(retry.generate(request, new AbortController().signal), delay)).resolves.toEqual({ value: { text: '{"ok":true}' } });
    expect(inner.requests).toHaveLength(2);
    expect(delay.requested).toEqual([500]);
  });

  it('ai-design-studio.UT10 / AC6 — a permanent failure gives up after the bound, backing off exponentially', async () => {
    const last = new UpstreamError('openrouter');
    // The scripted generator consumes its list, so the expected error is held apart.
    const { inner, delay, retry } = setup([new UpstreamError('openrouter'), new UpstreamError('openrouter'), last, '{"late":true}']);
    const outcome = await settle(retry.generate(request, new AbortController().signal), delay);
    expect(outcome).toEqual({ error: last });
    expect((outcome as { error: unknown }).error).toBe(last);
    expect(inner.requests).toHaveLength(3);
    expect(delay.requested).toEqual([500, 1_000]);
  });

  it('a provider rejection is not retried', async () => {
    const rejected = new ProviderRejectedError('openrouter');
    const { inner, retry } = setup([rejected, '{}']);
    await expect(retry.generate(request, new AbortController().signal)).rejects.toBe(rejected);
    expect(inner.requests).toHaveLength(1);
  });

  it('an error that is not an UpstreamError is not retried', async () => {
    const bug = new TypeError('bug');
    const { inner, retry } = setup([bug, '{}']);
    await expect(retry.generate(request, new AbortController().signal)).rejects.toBe(bug);
    expect(inner.requests).toHaveLength(1);
  });

  it('stops when the caller aborts, before or during the backoff', async () => {
    const first = new UpstreamError('openrouter');
    const aborted = new AbortController();
    aborted.abort();
    const before = setup([first, '{}']);
    await expect(before.retry.generate(request, aborted.signal)).rejects.toBe(first);
    expect(before.inner.requests).toHaveLength(1);

    const during = setup([first, '{}']);
    const caller = new AbortController();
    const outcome = during.retry.generate(request, caller.signal);
    await during.delay.advance(0);
    caller.abort();
    await expect(outcome).rejects.toBe(first);
    expect(during.inner.requests).toHaveLength(1);
  });

  it('reports the inner provider id', () => {
    expect(setup([]).retry.providerId).toBe('openrouter');
  });
});
