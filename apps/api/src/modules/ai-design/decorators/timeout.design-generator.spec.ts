/**
 * `TimeoutDesignGenerator` (`ai-design-studio.T05`; UT09; AC6) on a manual timeline.
 */
import { describe, expect, it } from 'vitest';

import { UpstreamError } from '../../../core/errors/index.js';
import { ManualDelay } from '../../../testing/index.js';
import { ProviderTimeoutError } from '../ai-design.errors.js';
import type { IDesignGenerator } from '../ai-design.interface.js';
import type { GenerationRequest, GenerationResult } from '../ai-design.types.js';
import { TimeoutDesignGenerator } from './timeout.design-generator.js';

const request: GenerationRequest = { instructions: 'x', messages: [], schema: {}, schemaName: 'design_proposal' };

/** Settles only when the test says so, and remembers the signal it was given. */
class ControlledGenerator implements IDesignGenerator {
  readonly providerId = 'gemini';
  signal: AbortSignal | undefined;
  private settle: { resolve: (result: GenerationResult) => void; reject: (error: unknown) => void } | undefined;

  generate(_request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    this.signal = signal;
    return new Promise((resolve, reject) => {
      this.settle = { resolve, reject };
      // Like a real adapter (fetch): an aborted call, or one started aborted, ends with an UpstreamError.
      const abort = () => {
        reject(new UpstreamError(this.providerId, { cause: signal.reason }));
      };
      if (signal.aborted) abort();
      else signal.addEventListener('abort', abort, { once: true });
    });
  }

  answer(text: string): void {
    this.settle?.resolve({ text });
  }
}

describe('TimeoutDesignGenerator', () => {
  it('ai-design-studio.UT09 / AC6 — a never-answering provider is aborted at the bound with ProviderTimeoutError', async () => {
    const inner = new ControlledGenerator();
    const delay = new ManualDelay();
    const outcome = new TimeoutDesignGenerator(inner, delay, 60_000).generate(request, new AbortController().signal);
    const settled = outcome.then(() => 'resolved', (error: unknown) => error);

    await delay.advance(59_999);
    expect(inner.signal?.aborted).toBe(false);
    await delay.advance(1);
    const error = await settled;
    expect(error).toBeInstanceOf(ProviderTimeoutError);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ code: 'UPSTREAM_FAILED', details: { provider: 'gemini' } });
    expect(inner.signal?.aborted).toBe(true);
    expect(inner.signal?.reason).toBe(error);
  });

  it('an answer in time is returned and the timer is cancelled', async () => {
    const inner = new ControlledGenerator();
    const delay = new ManualDelay();
    const outcome = new TimeoutDesignGenerator(inner, delay, 60_000).generate(request, new AbortController().signal);
    await delay.advance(1_000);
    inner.answer('{"ok":true}');
    await expect(outcome).resolves.toEqual({ text: '{"ok":true}' });
    expect(delay.pending).toBe(0);
    expect(inner.signal?.aborted).toBe(false);
  });

  it('a caller abort reaches the inner call and is not reported as a timeout', async () => {
    const inner = new ControlledGenerator();
    const caller = new AbortController();
    const outcome = new TimeoutDesignGenerator(inner, new ManualDelay(), 60_000).generate(request, caller.signal);
    caller.abort(new Error('stop'));
    const error = await outcome.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).not.toBeInstanceOf(ProviderTimeoutError);
  });

  it('a signal already aborted aborts the inner call at once', async () => {
    const inner = new ControlledGenerator();
    const caller = new AbortController();
    caller.abort();
    const outcome = new TimeoutDesignGenerator(inner, new ManualDelay(), 60_000).generate(request, caller.signal);
    await expect(outcome).rejects.toBeInstanceOf(UpstreamError);
    expect(inner.signal?.aborted).toBe(true);
  });

  it('reports the inner provider id', () => {
    expect(new TimeoutDesignGenerator(new ControlledGenerator(), new ManualDelay(), 1).providerId).toBe('gemini');
  });
});
