/**
 * `IRevalidationClient` that calls nothing and reports `ok` (`publish-pipeline.IT18`). Selected
 * only outside production with `WEB_REVALIDATE_URL` unset — the dev-bypass guard; production
 * without the URL fails startup instead.
 */
import type { IRevalidationClient } from '../publishing.interface.js';

export class NoopRevalidationClient implements IRevalidationClient {
  revalidate(): Promise<'ok'> {
    return Promise.resolve('ok');
  }
}
