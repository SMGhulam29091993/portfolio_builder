/**
 * HTTP in/out for sign-in, refresh, sign-out and the current user (`owner-auth.T05`;
 * `owner-auth.API01`–`API04`), and for the password reset (`owner-auth.T08`; `API05`–`API07`).
 *
 * No rules live here: each handler reads the validated body or the cookies, delegates to
 * `IAuthService` or `IPasswordResetService`, and turns the result into cookies plus the standard
 * envelope. Tokens only ever travel as cookies — the body carries the user and nothing else
 * (spec → Session contract); a one-time code only ever travels by email. Failures propagate to
 * the error middleware (Express 5).
 */
import type { RequestHandler, Response } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { ok } from '../../core/http/index.js';
import { SessionExpiredError } from './auth.errors.js';
import type {
  IAuthService,
  IPasswordResetService,
  ISessionCookieWriter,
} from './auth.interface.js';
import type {
  ForgotPasswordRequest,
  LoginRequest,
  ResendOtpRequest,
  ResetPasswordRequest,
  SignedInSession,
} from './auth.types.js';

/**
 * API05's message, the same whether or not the address is the owner's, so the response says
 * nothing about which it was (`owner-auth.AC17`).
 */
const CODE_REQUESTED_MESSAGE = 'If the address is registered, a code has been sent';

export class AuthController {
  constructor(
    private readonly auth: IAuthService,
    private readonly cookies: ISessionCookieWriter,
    private readonly passwordReset: IPasswordResetService,
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

  /**
   * `POST /api/v1/auth/password/forgot` — `owner-auth.API05`. The body passed
   * `forgotPasswordRequestSchema`. One message and one shape for every address.
   */
  readonly forgotPassword: RequestHandler = async (req, res) => {
    const issued = await this.passwordReset.requestCode(req.validatedBody as ForgotPasswordRequest);
    ok(res, CODE_REQUESTED_MESSAGE, issued);
  };

  /** `POST /api/v1/auth/password/resend` — `owner-auth.API06`. Body: `resendOtpRequestSchema`. */
  readonly resendCode: RequestHandler = async (req, res) => {
    const issued = await this.passwordReset.resend(req.validatedBody as ResendOtpRequest);
    ok(res, 'A new code has been sent', issued);
  };

  /**
   * `POST /api/v1/auth/password/reset` — `owner-auth.API07`. Body: `resetPasswordRequestSchema`.
   * The reset ended the session, so this browser's cookies are cleared too (`owner-auth.AC18`).
   */
  readonly resetPassword: RequestHandler = async (req, res) => {
    await this.passwordReset.reset(req.validatedBody as ResetPasswordRequest);
    this.cookies.clear(res);
    ok(res, 'Password updated');
  };

  /** Sets the session cookies and answers 200 with the user only. */
  private respondSignedIn(res: Response, { user, tokens }: SignedInSession, message: string): void {
    this.cookies.write(res, tokens);
    ok(res, message, { user });
  }
}
