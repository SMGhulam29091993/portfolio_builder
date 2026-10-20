/**
 * Request and response payloads of registration and email verification,
 * `account-registration.API01`–`API05` (`.ai-context/specs/account-registration.spec.md` →
 * API Contract). Shared with the CMS registration and verification screens.
 */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import {
  authEmailSchema,
  OTP_LENGTH,
  OTP_REFERENCE_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from './auth-contracts.js';

/** Longest display name, counted after cleaning. */
export const DISPLAY_NAME_MAX_LENGTH = 80;

/** Longest accepted owner secret in a request (the configured one is 32–200 characters). */
export const OWNER_SECRET_MAX_LENGTH = 200;

/** `account-registration.API01` — `data` of `GET /api/v1/auth/registration/options`. */
export const registrationOptionsResponseSchema = z.object({ ownerClaimOpen: z.boolean() });

/** `account-registration.API02` — `POST /api/v1/auth/register` body. */
export const registerRequestSchema = z.object({
  email: authEmailSchema,
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  displayName: plainText(DISPLAY_NAME_MAX_LENGTH),
  /**
   * The owner secret key. An empty string means "not given", so a form that always sends the
   * field still registers members once the claim is closed (spec → Edge Cases).
   */
  ownerSecret: z.preprocess(
    (value) => (value === '' ? undefined : value),
    z.string().max(OWNER_SECRET_MAX_LENGTH).optional(),
  ),
});

const referenceSchema = z.string().min(1).max(OTP_REFERENCE_MAX_LENGTH);

/** `account-registration.API03` — `POST /api/v1/auth/register/verify` body. */
export const verifyEmailRequestSchema = z.object({
  reference: referenceSchema,
  otp: z.string().regex(new RegExp(`^[0-9]{${String(OTP_LENGTH)}}$`)),
});

/** `account-registration.API04` — `POST /api/v1/auth/verification/request` body. */
export const verificationCodeRequestSchema = z.object({ email: authEmailSchema });

/** `account-registration.API05` — `POST /api/v1/auth/verification/resend` body. */
export const verificationResendRequestSchema = z.object({ reference: referenceSchema });

export type RegistrationOptionsResponse = z.infer<typeof registrationOptionsResponseSchema>;
export type RegisterRequest = z.infer<typeof registerRequestSchema>;
export type VerifyEmailRequest = z.infer<typeof verifyEmailRequestSchema>;
export type VerificationCodeRequest = z.infer<typeof verificationCodeRequestSchema>;
export type VerificationResendRequest = z.infer<typeof verificationResendRequestSchema>;
