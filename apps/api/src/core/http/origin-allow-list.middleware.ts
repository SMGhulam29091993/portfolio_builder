/**
 * Origin allow-list for state-changing requests (`owner-auth.T06`; `owner-auth.AC12`; spec →
 * Session contract, Origin allow-list).
 *
 * Every non-GET request under `/api/v1/auth` and `/api/v1/cms` must carry an `Origin` header
 * exactly equal to `WEB_ORIGIN`; anything else — no header, another host, port or scheme, the
 * opaque `null` origin — is refused with 403 `ORIGIN_NOT_ALLOWED`. Browsers attach `Origin` to
 * every cross-site and same-site POST, so a page on another site cannot drive a sign-in or a CMS
 * write with the owner's cookies, on top of what `SameSite` already blocks.
 *
 * The app factory mounts it ahead of the module routers, so it runs before any rate limiter,
 * validation or authentication: a refused request costs nothing and counts against nothing.
 *
 * GET and HEAD are not checked — they change nothing, and Express answers HEAD with the GET
 * handler, so treating it differently would split one route into two rules.
 */
import type { RequestHandler } from 'express';

import type { Env } from '../../config/env.js';
import { AppError } from '../errors/index.js';

/** Methods that never change state and pass without an `Origin` check. */
const UNCHECKED_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD']);

/**
 * 403 `ORIGIN_NOT_ALLOWED` — a state-changing request came from somewhere other than the web
 * app. Owned by `owner-auth`, kept beside the only code that throws it (`core/errors/http-errors.ts`
 * holds the generic codes only). The offending origin is not echoed back.
 */
export class OriginNotAllowedError extends AppError {
  readonly status = 403;

  constructor(message = 'Request origin is not allowed') {
    super('ORIGIN_NOT_ALLOWED', message);
  }
}

export class OriginAllowListMiddleware {
  /** The one origin allowed to send state-changing requests: the web app's. */
  private readonly allowedOrigin: string;

  /** @param env - `WEB_ORIGIN`, already validated as a bare origin by `loadEnv`. */
  constructor(env: Pick<Env, 'WEB_ORIGIN'>) {
    this.allowedOrigin = env.WEB_ORIGIN;
  }

  /** Express middleware; forwards `OriginNotAllowedError` to the error middleware on refusal. */
  readonly handle: RequestHandler = (req, _res, next) => {
    // Exact string match: `loadEnv` guarantees `WEB_ORIGIN` is in the serialised form browsers
    // send (scheme, host, port; no path or trailing slash), so no normalisation is needed.
    if (UNCHECKED_METHODS.has(req.method) || req.get('Origin') === this.allowedOrigin) {
      next();
      return;
    }
    next(new OriginNotAllowedError());
  };
}
