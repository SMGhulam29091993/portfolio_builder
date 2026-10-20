/**
 * Request and response payloads of the auth endpoints, `owner-auth.API01`–`API07`
 * (`.ai-context/specs/owner-auth.spec.md` → API Contract).
 *
 * Shared so the API validates with exactly the schemas the CMS login and password-reset forms
 * use (`int-standards.nextjs.md` → Forms). Tokens never appear in any of these payloads: the
 * session travels only in `HttpOnly` cookies (spec → Session contract).
 */
import { z } from 'zod';

/** The two account roles (ADR-0010): at most one `owner`, everyone else a `member`. */
export const USER_ROLES = ['owner', 'member'] as const;
export const userRoleSchema = z.enum(USER_ROLES);

/** Longest accepted email address (RFC 5321 path limit). */
export const EMAIL_MAX_LENGTH = 254;

/** Longest accepted password, at sign-in and at reset. Bounds the hashing work per request. */
export const PASSWORD_MAX_LENGTH = 200;

/**
 * Shortest password a reset may set. The same floor the owner seeder enforces on
 * `OWNER_PASSWORD` (`owner-auth.AC14`).
 */
export const PASSWORD_MIN_LENGTH = 12;

/** Digits in a one-time code. */
export const OTP_LENGTH = 6;

/** Longest accepted one-time-code reference. A bcrypt string is 60 characters. */
export const OTP_REFERENCE_MAX_LENGTH = 100;

/**
 * An email address, lower-cased so lookups are case-insensitive (spec → Edge Cases). Not
 * trimmed: a value with surrounding spaces is not a valid address and fails here.
 */
export const authEmailSchema = z.email().max(EMAIL_MAX_LENGTH).toLowerCase();

/**
 * A password as typed. Never trimmed or normalised, so leading and trailing spaces are part of
 * the password (`owner-auth.test_cases.md` → Data variations).
 */
const passwordSchema = z.string().min(1).max(PASSWORD_MAX_LENGTH);

/** The opaque reference the API returns with a one-time code and expects back with it. */
const otpReferenceSchema = z.string().min(1).max(OTP_REFERENCE_MAX_LENGTH);

/** `owner-auth.API01` — `POST /api/v1/auth/login` body. */
export const loginRequestSchema = z.object({
  email: authEmailSchema,
  password: passwordSchema,
});

/**
 * The signed-in user as every auth response returns it. No password hash, no token. `role`
 * joined with `account-registration` (additive).
 */
export const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  displayName: z.string(),
  role: userRoleSchema,
});

/** `data` of API01, API02 and API04: `{ user }`. */
export const authUserResponseSchema = z.object({ user: authUserSchema });

/** `owner-auth.API05` — `POST /api/v1/auth/password/forgot` body. */
export const forgotPasswordRequestSchema = z.object({ email: authEmailSchema });

/** `owner-auth.API06` — `POST /api/v1/auth/password/resend` body. */
export const resendOtpRequestSchema = z.object({ reference: otpReferenceSchema });

/** `owner-auth.API07` — `POST /api/v1/auth/password/reset` body. */
export const resetPasswordRequestSchema = z.object({
  reference: otpReferenceSchema,
  /** Exactly six ASCII digits; leading zeros are significant (`000000` is a valid code). */
  otp: z.string().regex(new RegExp(`^[0-9]{${String(OTP_LENGTH)}}$`)),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

/** `data` of API05 and API06: where to send the code back, and how long it is valid. */
export const otpIssuedResponseSchema = z.object({
  reference: z.string().min(1),
  expiresInSec: z.number().int().positive(),
});

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type AuthUser = z.infer<typeof authUserSchema>;
export type UserRole = z.infer<typeof userRoleSchema>;
export type AuthUserResponse = z.infer<typeof authUserResponseSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordRequestSchema>;
export type ResendOtpRequest = z.infer<typeof resendOtpRequestSchema>;
export type ResetPasswordRequest = z.infer<typeof resetPasswordRequestSchema>;
export type OtpIssuedResponse = z.infer<typeof otpIssuedResponseSchema>;
