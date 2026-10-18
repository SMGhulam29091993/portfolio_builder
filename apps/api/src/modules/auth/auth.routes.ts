/**
 * Router factory for the `auth` module, mounted under `/api/v1` by the app factory.
 * Documented in `openapi/openapi.yaml` as operations `owner-auth.API01`–`API07`.
 *
 * Order per route follows `architecture.md` → Request lifecycle: [limiter →] validate → guard →
 * controller. The Origin allow-list runs before all of it, mounted by the app factory on the
 * whole of `/auth` and `/cms` (`owner-auth.T06`). The password-reset routes (API05–API07) joined
 * with `owner-auth.T08`.
 */
import { EMAIL_MAX_LENGTH } from '@portfolio/contracts';
import type { Request, RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { AuthController } from './auth.controller.js';
import type { IAuthGuard } from './auth.interface.js';
import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  resendOtpRequestSchema,
  resetPasswordRequestSchema,
} from './auth.types.js';

/** Stands in for `req.ip` when Express cannot tell the client address. */
const UNKNOWN_CLIENT = 'unknown';

/**
 * The login rate limiter's key: client IP plus the email attempted (`owner-auth.AC3`), so one
 * address guessing at one account is stopped without locking out a different email from the
 * same IP (`owner-auth.IT03`).
 *
 * The limiter runs before validation, so the body is untrusted here. The email is lower-cased
 * as `loginRequestSchema` does, so `Owner@…` and `owner@…` share one count. Anything that is not
 * a string of a valid length becomes the empty email: such a body fails validation with 400,
 * which the limiter does not count, and an attacker-sized string never becomes a map key.
 * Only kept in process memory and never logged.
 */
export function loginAttemptKey(req: Request): string {
  const { email } = (req.body ?? {}) as { email?: unknown };
  const attempted =
    typeof email === 'string' && email.length <= EMAIL_MAX_LENGTH ? email.toLowerCase() : '';
  return `${req.ip ?? UNKNOWN_CLIENT} ${attempted}`;
}

/** The rate limiters the auth routes run, each built by the container's `RateLimiterFactory`. */
export interface AuthRateLimiters {
  /** Failed sign-ins on API01, keyed by `loginAttemptKey` (`owner-auth.AC3`). */
  readonly login: RequestHandler;
  /**
   * Code sends on API05 and API06 together, per client IP (spec → Password reset: send limit).
   * One instance on both routes, so the two share one count.
   */
  readonly codeSend: RequestHandler;
}

/**
 * @param controller - The module's controller.
 * @param requireOwner - The session guard, for the one auth route that needs a signed-in owner.
 * @param limiters - The login and code-send limiters.
 */
export function createAuthRouter(
  controller: AuthController,
  requireOwner: IAuthGuard,
  limiters: AuthRateLimiters,
): ApiRouter {
  return (
    new ApiRouter()
      // The limiter comes first so a sixth attempt is refused even with the right password.
      .route('post', '/auth/login', limiters.login, validate(loginRequestSchema), controller.login)
      // Refresh and logout read the cookies themselves: refresh must accept an expired access
      // token, and logout must succeed with no valid cookies at all, so neither is guarded.
      .route('post', '/auth/refresh', controller.refresh)
      .route('post', '/auth/logout', controller.logout)
      .route('get', '/auth/me', requireOwner, controller.me)
      // Password reset: none is guarded — the owner is signed out when they need it. The send
      // limiter runs before validation, so a malformed body still spends a send.
      .route(
        'post',
        '/auth/password/forgot',
        limiters.codeSend,
        validate(forgotPasswordRequestSchema),
        controller.forgotPassword,
      )
      .route(
        'post',
        '/auth/password/resend',
        limiters.codeSend,
        validate(resendOtpRequestSchema),
        controller.resendCode,
      )
      // No limiter of its own: guessing is bounded by the five attempts per code.
      .route(
        'post',
        '/auth/password/reset',
        validate(resetPasswordRequestSchema),
        controller.resetPassword,
      )
  );
}
