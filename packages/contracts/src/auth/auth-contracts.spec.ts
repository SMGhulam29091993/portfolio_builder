/**
 * Schema tests for the auth payloads — the data variations in `owner-auth.test_cases.md`.
 * The same schemas back the API's `validate()` middleware and the CMS forms, so a case pinned
 * here holds on both sides.
 */
import { describe, expect, it } from 'vitest';

import {
  forgotPasswordRequestSchema,
  loginRequestSchema,
  otpIssuedResponseSchema,
  resendOtpRequestSchema,
  resetPasswordRequestSchema,
} from './auth-contracts.js';

/** A syntactically valid address of exactly `length` characters. */
function emailOfLength(length: number): string {
  const domain = '@example.com';
  return `${'a'.repeat(length - domain.length)}${domain}`;
}

const VALID_RESET = {
  reference: '$2b$10$abcdefghijklmnopqrstuuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ012',
  otp: '123456',
  newPassword: 'twelve-chars',
};

describe('loginRequestSchema (owner-auth.API01)', () => {
  it('lower-cases the email so lookups are case-insensitive (owner-auth.IT23)', () => {
    const parsed = loginRequestSchema.parse({ email: 'Owner@Example.COM', password: 'x' });

    expect(parsed.email).toBe('owner@example.com');
  });

  it('keeps leading and trailing spaces in the password and accepts unicode', () => {
    const parsed = loginRequestSchema.parse({ email: 'o@example.com', password: '  päss wörd  ' });

    expect(parsed.password).toBe('  päss wörd  ');
  });

  it.each([
    ['a malformed email', { email: 'not-an-email', password: 'x' }],
    ['a 255-character email', { email: emailOfLength(255), password: 'x' }],
    ['an empty password', { email: 'o@example.com', password: '' }],
    ['a 201-character password', { email: 'o@example.com', password: 'p'.repeat(201) }],
  ])('rejects %s', (_case, body) => {
    expect(loginRequestSchema.safeParse(body).success).toBe(false);
  });

  it('accepts a 254-character email and a 200-character password (boundaries)', () => {
    const body = { email: emailOfLength(254), password: 'p'.repeat(200) };

    expect(loginRequestSchema.safeParse(body).success).toBe(true);
  });
});

describe('forgotPasswordRequestSchema (owner-auth.API05)', () => {
  it('lower-cases the email', () => {
    expect(forgotPasswordRequestSchema.parse({ email: 'A@B.CO' }).email).toBe('a@b.co');
  });
});

describe('resendOtpRequestSchema (owner-auth.API06)', () => {
  it.each([
    ['empty', ''],
    ['101 characters', 'r'.repeat(101)],
  ])('rejects a reference that is %s', (_case, reference) => {
    expect(resendOtpRequestSchema.safeParse({ reference }).success).toBe(false);
  });
});

describe('resetPasswordRequestSchema (owner-auth.API07)', () => {
  it('accepts a valid body, including the all-zero code', () => {
    expect(resetPasswordRequestSchema.safeParse(VALID_RESET).success).toBe(true);
    expect(resetPasswordRequestSchema.safeParse({ ...VALID_RESET, otp: '000000' }).success).toBe(
      true,
    );
  });

  it.each(['12345', '1234567', '12345a', ' 123456', '١٢٣٤٥٦'])('rejects the code %j', (otp) => {
    expect(resetPasswordRequestSchema.safeParse({ ...VALID_RESET, otp }).success).toBe(false);
  });

  it('rejects an 11-character new password and accepts 12 (owner-auth.AC18 boundary)', () => {
    expect(
      resetPasswordRequestSchema.safeParse({ ...VALID_RESET, newPassword: 'p'.repeat(11) }).success,
    ).toBe(false);
    expect(
      resetPasswordRequestSchema.safeParse({ ...VALID_RESET, newPassword: 'p'.repeat(12) }).success,
    ).toBe(true);
  });
});

describe('otpIssuedResponseSchema', () => {
  it('describes the API05 / API06 payload', () => {
    expect(otpIssuedResponseSchema.parse({ reference: 'r', expiresInSec: 600 })).toEqual({
      reference: 'r',
      expiresInSec: 600,
    });
  });
});
