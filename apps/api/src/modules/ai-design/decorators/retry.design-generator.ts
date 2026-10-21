/**
 * `RetryDesignGenerator` (`ai-design-studio.T05`; AC6; Decorator): retries transport failures —
 * an `UpstreamError` — a bounded number of times with exponential backoff. It does not retry a
 * `ProviderRejectedError` (the provider refused the request; asking again cannot help), anything
 * that is not an `UpstreamError`, or once the caller has aborted. Invalid output is not its
 * concern: the service's single repair attempt handles that (spec → Error Handling).
 */
import { UpstreamError } from '../../../core/errors/index.js';
import type { IDelay } from '../../../core/time/index.js';
import { ProviderRejectedError } from '../ai-design.errors.js';
import type { IDesignGenerator } from '../ai-design.interface.js';
import type { GenerationRequest, GenerationResult } from '../ai-design.types.js';

/** How many calls in all, and the wait before the first retry (doubled each time). */
export interface RetryPolicy {
  readonly attempts: number;
  readonly baseDelayMs: number;
}

export class RetryDesignGenerator implements IDesignGenerator {
  constructor(
    private readonly inner: IDesignGenerator,
    private readonly delay: IDelay,
    private readonly policy: RetryPolicy,
  ) {}

  get providerId(): IDesignGenerator['providerId'] {
    return this.inner.providerId;
  }

  async generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.inner.generate(request, signal);
      } catch (error) {
        const retryable = error instanceof UpstreamError && !(error instanceof ProviderRejectedError);
        if (!retryable || attempt >= this.policy.attempts || signal.aborted) throw error;
        const waited = await this.delay.wait(this.policy.baseDelayMs * 2 ** (attempt - 1), signal);
        // Aborted during the backoff: report the failure in hand rather than start another call.
        if (!waited) throw error;
      }
    }
  }
}
