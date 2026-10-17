/**
 * Domain types of the `auth` module (`owner-auth` plan → Data Model). Request and response
 * payloads are owned by `packages/contracts` and re-exported here
 * (`int-standards.express.md` → Input validation).
 */
export {
  authUserResponseSchema,
  authUserSchema,
  forgotPasswordRequestSchema,
  loginRequestSchema,
  otpIssuedResponseSchema,
  resendOtpRequestSchema,
  resetPasswordRequestSchema,
  type AuthUser,
  type AuthUserResponse,
  type ForgotPasswordRequest,
  type LoginRequest,
  type OtpIssuedResponse,
  type ResendOtpRequest,
  type ResetPasswordRequest,
} from '@portfolio/contracts';

/** A stored user. `users` is the only authentication source (`constitution.md` → Auth boundary). */
export interface User {
  readonly id: string;
  /** Lower-cased; unique. */
  readonly email: string;
  /** argon2id hash. Never logged, never returned over HTTP. */
  readonly passwordHash: string;
  readonly displayName: string;
  /** When the password was last set by a reset; absent until the first reset. */
  readonly passwordChangedAt?: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What creating a user needs; the repository assigns the id and timestamps. */
export interface NewUser {
  readonly email: string;
  readonly passwordHash: string;
  readonly displayName: string;
}

/**
 * The one session a user may hold, as stored in Redis (`owner-auth` spec → Session contract).
 * Keyed by user id, so a login replaces any previous session.
 */
export interface AuthSession {
  /** The session identifier carried in the access token and the `jti` cookie. */
  readonly jti: string;
  /** SHA-256 (hex) of the refresh token; the token itself is never stored. */
  readonly refreshTokenHash: string;
  readonly issuedAt: Date;
}

/**
 * The claims of an access token — exactly these four, nothing personal (`owner-auth` spec →
 * Session contract; `owner-auth.CT02`). Times are whole seconds since the epoch, as in JWT.
 */
export interface AccessTokenClaims {
  /** The user id. */
  readonly sub: string;
  /** The session identifier; must match the `jti` cookie and the stored session. */
  readonly jti: string;
  readonly iat: number;
  readonly exp: number;
}

/** The actions a one-time code can authorise. Only one exists today. */
export const OTP_PURPOSES = ['password_reset'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

/**
 * A one-time code document in `otps` (`owner-auth` spec → Password reset by one-time code).
 * One per `(userId, purpose)`.
 */
export interface OtpRecord {
  readonly id: string;
  readonly userId: string;
  readonly purpose: OtpPurpose;
  /** 64 hex characters; the lookup key the Redis reference resolves to. */
  readonly identifier: string;
  /** bcrypt hash of the 6-digit code. */
  readonly otpHash: string;
  /** Wrong codes entered against this document. */
  readonly attempts: number;
  readonly sentAt: Date;
  /** The code stops verifying after this instant. */
  readonly expiresAt: Date;
  /** MongoDB's TTL index deletes the document after this instant. */
  readonly purgeAt: Date;
}

/**
 * Everything an upsert writes. The document for `(userId, purpose)` is created or overwritten
 * with these values and `attempts` reset to 0 — a fresh code, whether first send or resend.
 */
export interface OtpIssue {
  readonly userId: string;
  readonly purpose: OtpPurpose;
  readonly identifier: string;
  readonly otpHash: string;
  readonly sentAt: Date;
  readonly expiresAt: Date;
  readonly purgeAt: Date;
}
