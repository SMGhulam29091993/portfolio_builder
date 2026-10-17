/**
 * HTTP in/out for sign-in, refresh, sign-out and the current user (`owner-auth.T05`;
 * `owner-auth.API01`–`API04`).
 *
 * No rules live here: each handler reads the validated body or the cookies, delegates to
 * `IAuthService`, and turns the result into cookies plus the standard envelope. Tokens only
 * ever travel as cookies — the body carries the user and nothing else (spec → Session
 * contract). Failures propagate to the error middleware (Express 5).
 *
 * The password-reset handlers (`IPasswordResetService`) join this class in `owner-auth.T08`.
 */
import type { RequestHandler, Response } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { ok } from '../../core/http/index.js';
import { SessionExpiredError } from './auth.errors.js';
import type { IAuthService, ISessionCookieWriter } from './auth.interface.js';
import type { LoginRequest, SignedInSession } from './auth.types.js';

export class AuthController {
  constructor(
    private readonly auth: IAuthService,
    private readonly cookies: ISessionCookieWriter,
  ) {}

  /** `POST /api/v1/auth/login` — `owner-auth.API01`. The body passed `loginRequestSchema`. */
  readonly login: RequestHandler = async (req, res) => {
    const signedIn = await this.auth.login(req.validatedBody as LoginRequest);
    this.respondSignedIn(res, signedIn, 'Signed in');
  };

  /** `POST /api/v1/auth/refresh` — `owner-auth.API02`. Reads all three cookies. */
  readonly refresh: RequestHandler = async (req, res) => {
    let refreshed: SignedInSession;
    try {
      refreshed = await this.auth.refresh(this.cookies.read(req));
    } catch (error) {
      // Every 401 of API02 clears the cookies: they can never refresh again. Anything else
      // (a 503 while Redis is down) keeps them, so the client can retry.
      if (error instanceof UnauthenticatedError || error instanceof SessionExpiredError) {
        this.cookies.clear(res);
      }
      throw error;
    }
    this.respondSignedIn(res, refreshed, 'Session refreshed');
  };

  /**
   * `POST /api/v1/auth/logout` — `owner-auth.API03`. Idempotent: the service ignores missing,
   * invalid or superseded cookies, and the cookies are cleared either way.
   */
  readonly logout: RequestHandler = async (req, res) => {
    await this.auth.logout(this.cookies.read(req));
    this.cookies.clear(res);
    ok(res, 'Signed out');
  };

  /** `GET /api/v1/auth/me` — `owner-auth.API04`, behind `requireOwner`. */
  readonly me: RequestHandler = async (req, res) => {
    // The guard always sets `req.auth` before this handler. Without it the route was wired
    // without the guard; refuse rather than answer for nobody.
    if (!req.auth) throw new UnauthenticatedError();
    ok(res, 'Current user', { user: await this.auth.me(req.auth.userId) });
  };

  /** Sets the session cookies and answers 200 with the user only. */
  private respondSignedIn(res: Response, { user, tokens }: SignedInSession, message: string): void {
    this.cookies.write(res, tokens);
    ok(res, message, { user });
  }
}
