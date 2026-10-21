/**
 * The CMS's one way to call the API (`cms-panel-shell.T01`; AC3; `int-standards.nextjs.md` →
 * API access).
 *
 * - Same-origin `/api/v1/**` only, so the `HttpOnly` session cookies travel automatically; the
 *   client never holds a token (`owner-auth` → Session contract).
 * - Unwraps the standard envelope `{ success, message, data }`; any failure becomes an
 *   `ApiError` carrying the canonical `code` and `data`, so callers branch on codes, never on
 *   message text.
 * - A 401 `UNAUTHENTICATED` on a non-auth route triggers the refresh rule, serialised across
 *   tabs with the Web Locks API because the API rejects a second refresh sent with the same
 *   cookies: inside the lock the original request is retried first (another tab may already
 *   have refreshed), then — only if still 401 — one refresh and one more retry. A second
 *   failure reports the session as expired.
 * - A 401 `SESSION_EXPIRED` never refreshes: a newer sign-in replaced this browser's session.
 *
 * Request bodies (passwords, codes) are never logged; nothing here logs at all.
 */

/** The API's version prefix, reached through the web app's rewrite. */
export const API_BASE = '/api/v1';

/** The name of the cross-tab lock every refresh holds. */
export const REFRESH_LOCK = 'portfolio-builder:auth-refresh';

/** A failed call: the HTTP status, the canonical `data.code`, and the whole `data`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly data: Readonly<Record<string, unknown>> = {},
    message = 'Request failed',
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Seconds to wait, from a 429's `retryAfterSec`; `undefined` otherwise. */
  get retryAfterSec(): number | undefined {
    const value = this.data.retryAfterSec;
    return typeof value === 'number' ? value : undefined;
  }
}

/** Why the browser no longer has a usable session. */
export type SessionLoss = 'expired' | 'superseded';

/** The subset of `LockManager` the client needs; injectable for tests. */
export interface LockLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export interface ApiClientOptions {
  /** Defaults to the global `fetch`. */
  readonly fetch?: typeof fetch;
  /** Defaults to `navigator.locks`; without one (old browsers, tests) refreshes run unlocked. */
  readonly locks?: LockLike;
  /** Told once when the session is gone, so the shell can send the user to sign in. */
  readonly onSessionLost?: (reason: SessionLoss) => void;
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialised as JSON. */
  readonly body?: unknown;
  readonly signal?: AbortSignal;
}

/** A successful envelope's message and data. */
export interface ApiResult<T> {
  readonly message: string;
  readonly data: T;
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly locks?: LockLike;

  constructor(private readonly options: ApiClientOptions = {}) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.locks = options.locks ?? globalLocks();
  }

  /** `data` of a successful call. */
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    return (await this.call<T>(path, options)).data;
  }

  /** The whole successful result, for screens that show the server's message. */
  async call<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
    try {
      return await this.send<T>(path, options);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || isAuthPath(path)) throw error;
      if (error.code === 'SESSION_EXPIRED') {
        this.options.onSessionLost?.('superseded');
        throw error;
      }
      return this.refreshAndRetry<T>(path, options);
    }
  }

  private async refreshAndRetry<T>(path: string, options: RequestOptions): Promise<ApiResult<T>> {
    const attempt = async (): Promise<ApiResult<T>> => {
      // Another tab may have refreshed while this request waited for the lock.
      try {
        return await this.send<T>(path, options);
      } catch (error) {
        if (!isUnauthenticated(error)) throw this.noticeLoss(error);
      }
      try {
        await this.send('/auth/refresh', { method: 'POST' });
      } catch (error) {
        throw this.lost(error);
      }
      try {
        return await this.send<T>(path, options);
      } catch (error) {
        throw this.lost(error);
      }
    };
    return this.locks ? this.locks.request(REFRESH_LOCK, attempt) : attempt();
  }

  /** Reports the loss for any 401 and passes the error on. */
  private lost(error: unknown): unknown {
    if (error instanceof ApiError && error.status === 401) {
      this.options.onSessionLost?.(error.code === 'SESSION_EXPIRED' ? 'superseded' : 'expired');
    }
    return error;
  }

  /** A `SESSION_EXPIRED` surfacing on the in-lock retry is a loss too. */
  private noticeLoss(error: unknown): unknown {
    if (error instanceof ApiError && error.code === 'SESSION_EXPIRED') {
      this.options.onSessionLost?.('superseded');
    }
    return error;
  }

  private async send<T>(path: string, { method = 'GET', body, signal }: RequestOptions): Promise<ApiResult<T>> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${API_BASE}${path}`, {
        method,
        credentials: 'same-origin',
        headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        ...(signal ? { signal } : {}),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(0, 'NETWORK_ERROR', {}, 'The server could not be reached');
    }

    const envelope = await readEnvelope(response);
    if (response.ok && envelope.success) {
      return { message: envelope.message, data: envelope.data as T };
    }
    const data = isRecord(envelope.data) ? envelope.data : {};
    const code = typeof data.code === 'string' ? data.code : 'INTERNAL_ERROR';
    throw new ApiError(response.status, code, data, envelope.message || 'Request failed');
  }
}

interface Envelope {
  readonly success: boolean;
  readonly message: string;
  readonly data?: unknown;
}

async function readEnvelope(response: Response): Promise<Envelope> {
  try {
    const parsed: unknown = await response.json();
    if (isRecord(parsed) && typeof parsed.success === 'boolean') {
      return {
        success: parsed.success,
        message: typeof parsed.message === 'string' ? parsed.message : '',
        data: parsed.data,
      };
    }
  } catch {
    // Not JSON — a proxy error page or an empty body.
  }
  return { success: false, message: '', data: { code: response.status >= 500 ? 'INTERNAL_ERROR' : 'UNEXPECTED_RESPONSE' } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnauthenticated(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401 && error.code === 'UNAUTHENTICATED';
}

/**
 * The auth routes that answer 401 for their own reasons (a wrong password, no session to
 * refresh) — never refreshed on. `/auth/me` is guarded like any `/cms` route, so an expired
 * access token there is refreshed.
 */
function isAuthPath(path: string): boolean {
  return path.startsWith('/auth/') && path !== '/auth/me';
}

function globalLocks(): LockLike | undefined {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) return undefined;
  const { locks } = navigator;
  return { request: (name, callback) => locks.request(name, callback) };
}
