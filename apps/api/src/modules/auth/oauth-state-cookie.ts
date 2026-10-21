/**
 * The `google-state` cookie (`google-sign-in` → API01, Session cookies after a cross-site
 * redirect): it carries the flow's `state` value so the callback can prove it reached the
 * browser that started the flow.
 *
 * `SameSite=Lax`, unlike the session cookies: the callback is a top-level navigation coming
 * from Google, and a `Strict` cookie would not be sent on it. `HttpOnly`, `Secure` in
 * production, scoped to the Google routes, and gone after 10 minutes — the state's own TTL.
 */
import type { CookieOptions, Request, Response } from 'express';

import type { Env } from '../../config/env.js';
import { parseCookieHeader } from '../../core/http/index.js';
import type { IOAuthStateCookie } from './auth.interface.js';

const COOKIE_NAME = 'google-state';

export interface OAuthStateCookieOptions {
  /** `/api/v1/auth/google` — only the two Google routes receive it. */
  readonly path: string;
  /** Whole seconds; the stored state's TTL. */
  readonly maxAgeSec: number;
}

export class OAuthStateCookie implements IOAuthStateCookie {
  private readonly base: CookieOptions;

  constructor(
    env: Pick<Env, 'NODE_ENV'>,
    private readonly options: OAuthStateCookieOptions,
  ) {
    this.base = {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: options.path,
    };
  }

  read(req: Request): string | undefined {
    return parseCookieHeader(req.headers.cookie).get(COOKIE_NAME);
  }

  write(res: Response, state: string): void {
    res.cookie(COOKIE_NAME, state, { ...this.base, maxAge: this.options.maxAgeSec * 1_000 });
  }

  clear(res: Response): void {
    res.clearCookie(COOKIE_NAME, this.base);
  }
}
