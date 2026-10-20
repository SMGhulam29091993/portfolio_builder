/**
 * `ApiClient` (`cms-panel-shell.UT02`, `UT03`, `UT08`; AC3) against a scripted `fetch` and an
 * in-process lock, so the refresh rule is proven without a browser.
 */
import { describe, expect, it } from 'vitest';

import { ApiClient, ApiError, type LockLike, type SessionLoss } from './client';

interface Scripted { status: number; body: unknown }

/** Answers each call with the next scripted response and records what was asked. */
function scriptedFetch(responses: Scripted[]) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchImpl = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: input instanceof Request ? input.url : input.toString(), method: init?.method ?? 'GET', ...(typeof init?.body === 'string' ? { body: init.body } : {}) });
    const next = responses.shift();
    if (!next) return Promise.reject(new TypeError('no scripted response'));
    return Promise.resolve(new Response(JSON.stringify(next.body), { status: next.status }));
  }) as typeof fetch;
  return { fetchImpl, calls };
}

const ok = (data: unknown): Scripted => ({ status: 200, body: { success: true, message: 'ok', data } });
const fail = (status: number, code: string, extra: object = {}): Scripted => ({
  status,
  body: { success: false, message: 'no', data: { code, ...extra } },
});

/** A lock that runs callbacks one at a time, as the Web Locks API does across tabs. */
class SerialLock implements LockLike {
  names: string[] = [];
  private tail: Promise<unknown> = Promise.resolve();
  request<T>(name: string, callback: () => Promise<T>): Promise<T> {
    this.names.push(name);
    const run = this.tail.then(callback, callback);
    this.tail = run.catch(() => undefined);
    return run;
  }
}

function client(responses: Scripted[]) {
  const { fetchImpl, calls } = scriptedFetch(responses);
  const losses: SessionLoss[] = [];
  const locks = new SerialLock();
  const api = new ApiClient({ fetch: fetchImpl, locks, onSessionLost: (reason) => losses.push(reason) });
  return { api, calls, losses, locks };
}

describe('ApiClient', () => {
  it('unwraps the envelope and sends JSON same-origin under /api/v1', async () => {
    const { api, calls } = client([ok({ value: 1 })]);

    await expect(api.request('/cms/portfolio', { method: 'PUT', body: { a: 1 } })).resolves.toEqual({ value: 1 });
    expect(calls).toEqual([{ url: '/api/v1/cms/portfolio', method: 'PUT', body: '{"a":1}' }]);
  });

  it('turns a failure envelope into ApiError with the code and data', async () => {
    const { api } = client([fail(409, 'REVISION_CONFLICT', { currentRevision: 4 })]);

    const error = await api.request('/cms/x').catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'REVISION_CONFLICT', data: { currentRevision: 4 } });
  });

  it('exposes retryAfterSec on a 429', async () => {
    const { api } = client([fail(429, 'RATE_LIMITED', { retryAfterSec: 37 })]);

    const error = (await api.request('/auth/login', { method: 'POST' }).catch((caught: unknown) => caught)) as ApiError;

    expect(error.retryAfterSec).toBe(37);
  });

  it('cms-panel-shell.UT02 — 401, retry inside the lock, refresh, retry: resolves', async () => {
    const { api, calls, losses, locks } = client([
      fail(401, 'UNAUTHENTICATED'),
      fail(401, 'UNAUTHENTICATED'),
      ok({ user: {} }),
      ok({ saved: true }),
    ]);

    await expect(api.request('/cms/portfolio')).resolves.toEqual({ saved: true });
    expect(calls.map((call) => call.url)).toEqual([
      '/api/v1/cms/portfolio',
      '/api/v1/cms/portfolio',
      '/api/v1/auth/refresh',
      '/api/v1/cms/portfolio',
    ]);
    expect(locks.names).toEqual(['portfolio-builder:auth-refresh']);
    expect(losses).toEqual([]);
  });

  it('cms-panel-shell.AC3 — another tab already refreshed: the in-lock retry succeeds, no refresh', async () => {
    const { api, calls } = client([fail(401, 'UNAUTHENTICATED'), ok({ fine: true })]);

    await expect(api.request('/cms/portfolio')).resolves.toEqual({ fine: true });
    expect(calls.map((call) => call.url)).not.toContain('/api/v1/auth/refresh');
  });

  it('cms-panel-shell.UT03 — a 401 after the refresh reports the session expired; no third try', async () => {
    const { api, calls, losses } = client([
      fail(401, 'UNAUTHENTICATED'),
      fail(401, 'UNAUTHENTICATED'),
      ok({}),
      fail(401, 'UNAUTHENTICATED'),
    ]);

    await expect(api.request('/cms/portfolio')).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(4);
    expect(losses).toEqual(['expired']);
  });

  it('a refused refresh reports the session expired', async () => {
    const { api, losses } = client([fail(401, 'UNAUTHENTICATED'), fail(401, 'UNAUTHENTICATED'), fail(401, 'UNAUTHENTICATED')]);

    await expect(api.request('/cms/portfolio')).rejects.toBeInstanceOf(ApiError);
    expect(losses).toEqual(['expired']);
  });

  it('cms-panel-shell.UT08 — SESSION_EXPIRED never refreshes', async () => {
    const { api, calls, losses } = client([fail(401, 'SESSION_EXPIRED')]);

    await expect(api.request('/cms/portfolio')).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    expect(calls).toHaveLength(1);
    expect(losses).toEqual(['superseded']);
  });

  it('never refreshes on an /auth route (a wrong password is a 401)', async () => {
    const { api, calls, losses } = client([fail(401, 'UNAUTHENTICATED')]);

    await expect(api.request('/auth/login', { method: 'POST', body: {} })).rejects.toMatchObject({ status: 401 });
    expect(calls).toHaveLength(1);
    expect(losses).toEqual([]);
  });

  it('maps a network failure and a non-JSON body to stable codes', async () => {
    const network = new ApiClient({ fetch: (() => Promise.reject(new TypeError('offline'))) });
    await expect(network.request('/x')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });

    const html = new ApiClient({ fetch: (() => Promise.resolve(new Response('<html>', { status: 502 }))) });
    await expect(html.request('/x')).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });
});
