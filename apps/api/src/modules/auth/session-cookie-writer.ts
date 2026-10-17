/**
 * `ISessionCookieWriter` — the three session cookies (`owner-auth.T05`; spec → Session
 * contract).
 *
 * | Cookie          | Holds                    | Path           |
 * |-----------------|--------------------------|----------------|
 * | `access-token`  | the access JWT           | `/api/v1`      |
 * | `jti`           | the session's `jti`      | `/api/v1`      |
 * | `refresh-token` | the opaque refresh token | `/api/v1/auth` |
 *
 * All three are `HttpOnly` and live as long as the session (7 days) — longer than the 15-minute
 * JWT, so refresh can still read an expired token. In production they are also `Secure` and
 * `SameSite=Strict`; elsewhere neither `Secure` (local HTTP) nor stricter than `Lax`. The flag
 * comes from the injected `env`, never `process.env`.
 *
 * The refresh token's narrower path keeps it off every `/cms` request: only the auth routes,
 * which need it, ever receive it.
 *
 * Values are never logged (`owner-auth.AC15`).
 */
import type { CookieOptions, Request, Response } from 'express';

import type { Env } from '../../config/env.js';
import { parseCookieHeader } from '../../core/http/index.js';
import type { ISessionCookieWriter } from './auth.interface.js';
import type { SessionCookies, SessionTokens } from './auth.types.js';

/** Cookie names, fixed by the session contract. */
const ACCESS_TOKEN_COOKIE = 'access-token';
const REFRESH_TOKEN_COOKIE = 'refresh-token';
const JTI_COOKIE = 'jti';

export interface SessionCookieWriterOptions {
  /** Path of the access-token and `jti` cookies: the API prefix, `/api/v1`. */
  readonly apiPath: string;
  /** Path of the refresh-token cookie: the auth routes, `/api/v1/auth`. */
  readonly authPath: string;
  /** Cookie lifetime in whole seconds; the session's TTL (7 days). */
  readonly maxAgeSec: number;
}

export class SessionCookieWriter implements ISessionCookieWriter {
  /** Attributes shared by every cookie this class writes or clears, path aside. */
  private readonly baseOptions: CookieOptions;

  constructor(
    env: Pick<Env, 'NODE_ENV'>,
    private readonly options: SessionCookieWriterOptions,
  ) {
    const production = env.NODE_ENV === 'production';
    this.baseOptions = {
      httpOnly: true,
      secure: production,
      sameSite: production ? 'strict' : 'lax',
    };
  }

  read(req: Request): SessionCookies {
    const cookies = parseCookieHeader(req.headers.cookie);
    return {
      accessToken: cookies.get(ACCESS_TOKEN_COOKIE),
      jti: cookies.get(JTI_COOKIE),
      refreshToken: cookies.get(REFRESH_TOKEN_COOKIE),
    };
  }

  write(res: Response, { accessToken, refreshToken, jti }: SessionTokens): void {
    // `res.cookie` takes milliseconds and writes both `Max-Age` (seconds) and `Expires`.
    const maxAge = this.options.maxAgeSec * 1_000;
    res.cookie(ACCESS_TOKEN_COOKIE, accessToken, this.optionsFor(this.options.apiPath, maxAge));
    res.cookie(JTI_COOKIE, jti, this.optionsFor(this.options.apiPath, maxAge));
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, this.optionsFor(this.options.authPath, maxAge));
  }

  clear(res: Response): void {
    // A browser only drops a cookie when the clearing header names the same path it was set on.
    res.clearCookie(ACCESS_TOKEN_COOKIE, this.optionsFor(this.options.apiPath));
    res.clearCookie(JTI_COOKIE, this.optionsFor(this.options.apiPath));
    res.clearCookie(REFRESH_TOKEN_COOKIE, this.optionsFor(this.options.authPath));
  }

  private optionsFor(path: string, maxAge?: number): CookieOptions {
    return maxAge === undefined ? { ...this.baseOptions, path } : { ...this.baseOptions, path, maxAge };
  }
}
