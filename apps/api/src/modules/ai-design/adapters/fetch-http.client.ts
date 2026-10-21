/**
 * `FetchHttpClient` — `IHttpClient` over `fetch` (`ai-design-studio.T06`; AC13). Every adapter's
 * transport failure leaves here as an `UpstreamError` naming the provider, never a fetch or
 * provider type. The cause is kept for the log; a response body is never put in a message,
 * since it could echo what was sent.
 */
import { UpstreamError } from '../../../core/errors/index.js';
import { ProviderRejectedError } from '../ai-design.errors.js';
import type { IHttpClient } from '../ai-design.interface.js';
import type { AiProviderId } from '../ai-design.types.js';

/** The subset of `fetch` used here; injected so tests need no global patching. */
export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

const TOO_MANY_REQUESTS = 429;

export class FetchHttpClient implements IHttpClient {
  constructor(private readonly fetchFn: FetchFunction = fetch) {}

  async postJson(
    provider: AiProviderId,
    url: string,
    headers: Readonly<Record<string, string>>,
    body: unknown,
    signal: AbortSignal,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
        body: JSON.stringify(body),
        signal,
      });
    } catch (error) {
      throw new UpstreamError(provider, { cause: error });
    }
    if (!response.ok) {
      // Drain the body so the connection can be reused; its content is not trusted or logged.
      await response.body?.cancel().catch(() => undefined);
      const cause = new Error(`HTTP ${String(response.status)}`);
      const rejected = response.status >= 400 && response.status < 500 && response.status !== TOO_MANY_REQUESTS;
      throw rejected ? new ProviderRejectedError(provider, { cause }) : new UpstreamError(provider, { cause });
    }
    try {
      const parsed: unknown = await response.json();
      return parsed;
    } catch (error) {
      throw new UpstreamError(provider, { cause: error });
    }
  }

  async probe(url: string, headers: Readonly<Record<string, string>>, timeoutMs: number): Promise<boolean> {
    try {
      const response = await this.fetchFn(url, { method: 'GET', headers: { ...headers }, signal: AbortSignal.timeout(timeoutMs) });
      await response.body?.cancel().catch(() => undefined);
      return response.ok;
    } catch {
      return false;
    }
  }
}
