/**
 * Domain types of the `auth` module (`owner-auth` plan → Data Model). Request and response
 * payloads are owned by `packages/contracts` and re-exported here
 * (`int-standards.express.md` → Input validation).
 */
import type { AuthUser, UserRole } from '@portfolio/contracts';

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
  USER_ROLES,
  registerRequestSchema,
  registrationOptionsResponseSchema,
  verificationCodeRequestSchema,
  verificationResendRequestSchema,
  verifyEmailRequestSchema,
  type RegisterRequest,
  type RegistrationOptionsResponse,
  type UserRole,
  type VerificationCodeRequest,
  type VerificationResendRequest,
  type VerifyEmailRequest,
} from '@portfolio/contracts';

/** A stored user. `users` is the only authentication source (`constitution.md` → Auth boundary). */
export interface User {
  readonly id: string;
  /** Lower-cased; unique. */
  readonly email: string;
  /** argon2id hash. Never logged, never returned over HTTP. */
  readonly passwordHash: string;
  readonly displayName: string;
  /**
   * `owner` for the one platform owner, `member` for everyone else (ADR-0010). A document
   * written before `account-registration` has no role and reads as `member`.
   */
  readonly role: UserRole;
  /**
   * When the email was proved by a one-time code (`account-registration`). Absent: the account
   * cannot sign in yet.
   */
  readonly emailVerifiedAt?: Date;
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
  /** Default `member`. */
  readonly role?: UserRole;
  /** Set for an account whose email is already proved (the development seeder). */
  readonly emailVerifiedAt?: Date;
}

/**
 * What re-registering an unverified account replaces (`account-registration.AC3`). `role` is
 * given only when the request carried a matching owner claim; otherwise the stored role stays.
 */
export interface PendingUserUpdate {
  readonly passwordHash: string;
  readonly displayName: string;
  readonly role?: UserRole;
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

/**
 * The session cookies a request carried, as the controller and guard read them (`owner-auth.T05`).
 * Every field is optional because any cookie may be missing; services decide what an absent
 * one means. Never logged (`owner-auth.AC15`).
 */
export interface SessionCookies {
  /** The `access-token` cookie: the access JWT. */
  readonly accessToken?: string;
  /** The `jti` cookie: the session identifier the browser was given. */
  readonly jti?: string;
  /** The `refresh-token` cookie. Sent only to `/api/v1/auth`, so the guard never sees it. */
  readonly refreshToken?: string;
}

/** What the `jti` triple match reads: the access token and the `jti` cookie. */
export type SessionCredentials = Pick<SessionCookies, 'accessToken' | 'jti'>;

/** A request whose access token, `jti` cookie and stored session all agree. */
export interface AuthorizedSession {
  /** The token's `sub`: the signed-in user. */
  readonly userId: string;
  /** The stored session the three `jti` values matched. */
  readonly session: AuthSession;
}

/**
 * The three values a sign-in or refresh hands to the cookie writer (`owner-auth.T05`). They
 * never appear in a response body (spec → Session contract).
 */
export interface SessionTokens {
  readonly accessToken: string;
  /** The raw refresh token; only its SHA-256 is stored. */
  readonly refreshToken: string;
  readonly jti: string;
}

/** The result of a sign-in or refresh: the user for the body, the tokens for the cookies. */
export interface SignedInSession {
  readonly user: AuthUser;
  readonly tokens: SessionTokens;
}

/**
 * Who a guarded request is from, as `requireOwner` sets it on `req.auth` once all three `jti`
 * values match (spec → Request authorization, step 4; `owner-auth.AC4`). A controller behind
 * the guard reads `req.auth.userId` and nothing else about the session.
 */
export interface AuthContext {
  readonly userId: string;
}

declare global {
  // Express exposes its request type through this global namespace; augmenting it is the
  // documented way to add a field (as `core/http/request-context.ts` does). Declared here, in
  // the module that sets it, because `core` may not know about `auth`.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `requireOwner` only; absent on any route the guard does not run on. */
      auth?: AuthContext;
    }
  }
}

/**
 * The actions a one-time code can authorise. A code issued for one purpose never completes
 * another (`account-registration.AC12`).
 */
export const OTP_PURPOSES = ['password_reset', 'email_verification'] as const;
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

/**
 * One outgoing email (ADR-0009). Plain text only: there is no HTML part and no link, so a
 * message can carry nothing a mail client would render or follow.
 */
export interface MailMessage {
  /** The recipient's address. PII: never logged (`constitution.md` → PII / logging rules). */
  readonly to: string;
  readonly subject: string;
  /** The body. It holds a one-time code, so it is never logged either. */
  readonly text: string;
}
