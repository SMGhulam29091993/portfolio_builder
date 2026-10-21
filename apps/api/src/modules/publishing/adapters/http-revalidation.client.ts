/**
 * `IRevalidationClient` over HTTP (`publish-pipeline.T07`; AC12, CT03): `POST` the slug to the
 * web app's revalidate route with the shared secret in `x-revalidate-secret`. Never throws — a
 * non-2xx answer, a network error or the timeout all resolve to `failed`, which is recorded on
 * the snapshot and retried through API06. The secret is never logged.
 */
import type { IRevalidationClient } from '../publishing.interface.js';

export interface HttpRevalidationSettings {
  readonly url: string;
  readonly secret: string;
  /** Upper bound on one call, so a slow web app cannot hold a publish open. */
  readonly timeoutMs: number;
}

/** The subset of `fetch` used here; injected so tests need no global patching. */
export type FetchFunction = (url: string, init: RequestInit) => Promise<Response>;

export class HttpRevalidationClient implements IRevalidationClient {
  constructor(
    private readonly settings: HttpRevalidationSettings,
    private readonly fetchFn: FetchFunction = fetch,
  ) {}

  async revalidate(slug: string): Promise<'ok' | 'failed'> {
    try {
      const response = await this.fetchFn(this.settings.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-revalidate-secret': this.settings.secret },
        body: JSON.stringify({ slug }),
        signal: AbortSignal.timeout(this.settings.timeoutMs),
      });
      return response.ok ? 'ok' : 'failed';
    } catch {
      return 'failed';
    }
  }
}
