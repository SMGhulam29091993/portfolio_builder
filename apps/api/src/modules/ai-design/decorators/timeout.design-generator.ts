/**
 * `TimeoutDesignGenerator` (`ai-design-studio.T05`; AC6; Decorator): bounds one generation —
 * retries included, since it wraps `RetryDesignGenerator` — by `AI_TIMEOUT_MS`. When the time
 * is up it aborts the inner call and rejects with `ProviderTimeoutError`, which the service
 * records as `PROVIDER_TIMEOUT`. The adapter is untouched (Open / Closed).
 */
import type { IDelay } from '../../../core/time/index.js';
import { ProviderTimeoutError } from '../ai-design.errors.js';
import type { IDesignGenerator } from '../ai-design.interface.js';
import type { GenerationRequest, GenerationResult } from '../ai-design.types.js';

export class TimeoutDesignGenerator implements IDesignGenerator {
  constructor(
    private readonly inner: IDesignGenerator,
    private readonly delay: IDelay,
    private readonly timeoutMs: number,
  ) {}

  get providerId(): IDesignGenerator['providerId'] {
    return this.inner.providerId;
  }

  async generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult> {
    // One controller for the inner call: the caller's abort and the timeout both end it.
    const call = new AbortController();
    const forward = () => {
      call.abort(signal.reason);
    };
    if (signal.aborted) forward();
    else signal.addEventListener('abort', forward, { once: true });
    const timer = new AbortController();

    let timeout: ProviderTimeoutError | undefined;
    const timedOut = this.delay.wait(this.timeoutMs, timer.signal).then((elapsed): Promise<never> => {
      // Cancelled because the call settled first: never settle, the race is already decided.
      if (!elapsed) return new Promise<never>(() => undefined);
      timeout = new ProviderTimeoutError(this.providerId);
      call.abort(timeout);
      return Promise.reject(timeout);
    });
    try {
      return await Promise.race([this.inner.generate(request, call.signal), timedOut]);
    } catch (error) {
      // Aborting runs the inner call's abort listener at once, so its own rejection can win the
      // race; once the time is up, the answer is the timeout whatever settled first.
      throw timeout ?? error;
    } finally {
      timer.abort();
      signal.removeEventListener('abort', forward);
    }
  }
}
