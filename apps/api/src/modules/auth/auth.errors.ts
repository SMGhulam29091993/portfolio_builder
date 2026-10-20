/**
 * Errors owned by the `auth` module. Feature-specific codes live next to the feature, not in
 * `core/errors` (`core/errors/http-errors.ts`); the code and status are fixed by
 * `int-standards.express.md` → Error codes.
 */
import { AppError } from '../../core/errors/index.js';

/**
 * 401 `SESSION_EXPIRED` — the access token is genuine but its `jti` no longer matches the `jti`
 * cookie or the stored session, because a newer sign-in or refresh replaced this browser's
 * session (`owner-auth.AC6`, `AC7`). Thrown only after the token's signature was verified, so
 * it tells a caller without a genuine token nothing (spec → Error Handling).
 */
export class SessionExpiredError extends AppError {
  readonly status = 401;

  constructor(message = 'Your session has ended. Please sign in again') {
    super('SESSION_EXPIRED', message);
  }
}

/**
 * 400 `OTP_INVALID` — one body for every way a one-time code can fail to verify: a reference
 * that resolves to nothing, no `otps` document behind it, the 5 attempts used up, or a wrong
 * code (`owner-auth` spec → Error Handling; `owner-auth.AC18`, `AC19`, `AC21`). One body, so a
 * caller learns nothing about which of the four it hit.
 */
export class OtpInvalidError extends AppError {
  readonly status = 400;

  constructor(message = 'The code is invalid') {
    super('OTP_INVALID', message);
  }
}

/**
 * 400 `OTP_EXPIRED` — the code's `expiresAt` has passed (`owner-auth.AC20`). Distinct from
 * `OTP_INVALID` so the reset screen can offer a resend; only a caller holding a real reference
 * can reach it, so it reveals nothing to anyone else.
 */
export class OtpExpiredError extends AppError {
  readonly status = 400;

  constructor(message = 'The code has expired. Request a new one') {
    super('OTP_EXPIRED', message);
  }
}

/**
 * 403 `EMAIL_NOT_VERIFIED` — the password was right but the account's email has not been
 * proved yet (`account-registration.AC9`). Thrown only after a successful password check, so
 * it tells nothing to anyone without the password.
 */
export class EmailNotVerifiedError extends AppError {
  readonly status = 403;

  constructor(message = 'Verify your email address before signing in') {
    super('EMAIL_NOT_VERIFIED', message);
  }
}

/**
 * 403 `OWNER_CLAIM_REFUSED` — a registration carried an owner secret while the claim is
 * closed (an owner exists, or no secret is configured) or the value differs
 * (`account-registration.AC5`). One error for all three, so a caller cannot tell them apart.
 */
export class OwnerClaimRefusedError extends AppError {
  readonly status = 403;

  constructor(message = 'The owner key was not accepted') {
    super('OWNER_CLAIM_REFUSED', message);
  }
}
