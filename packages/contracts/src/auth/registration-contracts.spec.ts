/**
 * Schema tests for the registration payloads — the data variations in
 * `account-registration.test_cases.md`.
 */
import { describe, expect, it } from 'vitest';

import {
  registerRequestSchema,
  verificationCodeRequestSchema,
  verifyEmailRequestSchema,
} from './registration-contracts.js';

const VALID = {
  email: 'New.User@Example.TEST',
  password: 'twelve-chars',
  displayName: 'Ann',
};

describe('registerRequestSchema (account-registration.API02)', () => {
  it('lower-cases the email and cleans the display name', () => {
    const parsed = registerRequestSchema.parse({ ...VALID, displayName: ' <b>Ann</b> ' });

    expect(parsed).toEqual({
      email: 'new.user@example.test',
      password: 'twelve-chars',
      displayName: 'Ann',
    });
  });

  it.each([
    ['absent', undefined, undefined],
    ['empty', '', undefined],
    ['given', 'the-secret', 'the-secret'],
  ])('treats an ownerSecret that is %s as %j', (_case, ownerSecret, expected) => {
    expect(registerRequestSchema.parse({ ...VALID, ownerSecret }).ownerSecret).toBe(expected);
  });

  it.each([
    ['an 11-character password', { password: 'p'.repeat(11) }],
    ['a 201-character password', { password: 'p'.repeat(201) }],
    ['a blank display name', { displayName: '   ' }],
    ['an 81-character display name', { displayName: 'n'.repeat(81) }],
    ['a 201-character owner secret', { ownerSecret: 's'.repeat(201) }],
    ['a malformed email', { email: 'nope' }],
  ])('rejects %s', (_case, override) => {
    expect(registerRequestSchema.safeParse({ ...VALID, ...override }).success).toBe(false);
  });

  it('accepts the 12- and 200-character password boundaries', () => {
    expect(registerRequestSchema.safeParse({ ...VALID, password: 'p'.repeat(12) }).success).toBe(
      true,
    );
    expect(registerRequestSchema.safeParse({ ...VALID, password: 'p'.repeat(200) }).success).toBe(
      true,
    );
  });
});

describe('verifyEmailRequestSchema (account-registration.API03)', () => {
  it.each(['12345', '1234567', 'abcdef'])('rejects the code %j', (otp) => {
    expect(verifyEmailRequestSchema.safeParse({ reference: 'r', otp }).success).toBe(false);
  });

  it('accepts six digits, leading zeros included', () => {
    expect(verifyEmailRequestSchema.safeParse({ reference: 'r', otp: '000123' }).success).toBe(
      true,
    );
  });
});

describe('verificationCodeRequestSchema (account-registration.API04)', () => {
  it('lower-cases the email', () => {
    expect(verificationCodeRequestSchema.parse({ email: 'A@B.CO' }).email).toBe('a@b.co');
  });
});
