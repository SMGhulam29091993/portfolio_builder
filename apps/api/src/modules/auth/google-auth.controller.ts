/**
 * HTTP in/out for Google sign-in (`google-sign-in.T03`; `google-sign-in.API01`, `API02`).
 *
 * Both routes answer with redirects, never JSON: the browser navigates here, so a success goes
 * to the CMS and every failure to the CMS sign-in page with `error=<reason>` — one word from a
 * fixed list, never a cause. Redirect targets are built from `WEB_ORIGIN` only, so no request
 * value can choose where the browser goes (no open redirect).
 *
 * A failure that is not a `GoogleSignInError` (a bug, an unexpected datastore error) still
 * redirects with `google_failed`, and is logged by class name and request id only — never the
 * code, state, cookie or email.
 */
import type { Request, RequestHandler, Response } from 'express';

import type { ILogger } from '../../core/logger/logger.interface.js';
import { GoogleSignInError, type GoogleFailureReason } from './auth.errors.js';
import type {
  IGoogleSignInService,
  IOAuthStateCookie,
  ISessionCookieWriter,
} from './auth.interface.js';

/** Where the browser lands; paths under the web app's origin (`cms-panel-shell`). */
export interface GoogleRedirectTargets {
  /** e.g. `http://localhost:3000/cms`. */
  readonly success: string;
  /** e.g. `http://localhost:3000/cms/login`; `?error=<reason>` is appended. */
  readonly failure: string;
}

/** Longest query value read from the callback; anything longer is treated as absent. */
const MAX_QUERY_VALUE_LENGTH = 2_048;

export class GoogleAuthController {
  constructor(
    private readonly google: IGoogleSignInService,
    private readonly sessionCookies: ISessionCookieWriter,
    private readonly stateCookie: IOAuthStateCookie,
    private readonly targets: GoogleRedirectTargets,
    private readonly logger: ILogger,
  ) {}

  /** `GET /api/v1/auth/google/start` — `google-sign-in.API01`. */
  readonly start: RequestHandler = async (req, res) => {
    try {
      const { redirectUrl, state } = await this.google.start();
      this.stateCookie.write(res, state);
      res.redirect(302, redirectUrl);
    } catch (error) {
      this.fail(req, res, error);
    }
  };

  /** `GET /api/v1/auth/google/callback` — `google-sign-in.API02`. */
  readonly callback: RequestHandler = async (req, res) => {
    try {
      const signedIn = await this.google.complete({
        error: queryValue(req, 'error'),
        code: queryValue(req, 'code'),
        state: queryValue(req, 'state'),
        cookieState: this.stateCookie.read(req),
      });
      this.stateCookie.clear(res);
      this.sessionCookies.write(res, signedIn.tokens);
      res.redirect(302, this.targets.success);
    } catch (error) {
      this.fail(req, res, error);
    }
  };

  /** Clears the state cookie and redirects to the sign-in page with the reason word. */
  private fail(req: Request, res: Response, error: unknown): void {
    let reason: GoogleFailureReason = 'google_failed';
    if (error instanceof GoogleSignInError) {
      reason = error.reason;
    } else {
      this.logger.error('google sign-in failed unexpectedly', {
        requestId: req.requestId,
        errorClass: error instanceof Error ? error.constructor.name : typeof error,
      });
    }
    this.stateCookie.clear(res);
    const target = new URL(this.targets.failure);
    target.searchParams.set('error', reason);
    res.redirect(302, target.toString());
  }
}

/** A single string query value, or `undefined` when absent, repeated or oversized. */
function queryValue(req: Request, name: string): string | undefined {
  const value: unknown = req.query[name];
  return typeof value === 'string' && value.length <= MAX_QUERY_VALUE_LENGTH ? value : undefined;
}
