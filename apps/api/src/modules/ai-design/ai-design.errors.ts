/**
 * Errors of the `ai-design` module. `ProviderTimeoutError` lets the service tell a timeout
 * (`PROVIDER_TIMEOUT`) from any other transport failure (`PROVIDER_ERROR`; AC6) while still
 * being an `UpstreamError` at the port — no provider-specific type crosses it (AC13).
 */
import { UpstreamError } from '../../core/errors/index.js';

/** Thrown by `TimeoutDesignGenerator` when `AI_TIMEOUT_MS` elapses; the call was aborted. */
export class ProviderTimeoutError extends UpstreamError {
  constructor(provider: string, options?: ErrorOptions) {
    super(provider, options, 'The design provider did not answer in time');
  }
}
