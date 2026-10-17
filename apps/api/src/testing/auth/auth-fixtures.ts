/**
 * Fixture factories for the `auth` module (`.agent/workflows/generate-tests.md` step 5).
 *
 * Every value is an obvious placeholder: no real email domain, and hashes that are well-formed
 * strings but not hashes of anything, so no fixture can be mistaken for a credential.
 */
import { Types } from 'mongoose';

import type { AuthSession, NewUser, OtpIssue } from '../../modules/auth/index.js';
import { FixtureFactory } from '../fixture-factory.js';

/** Fixed base instant, so date fields are deterministic between runs. */
const BASE_TIME_MS = Date.UTC(2026, 0, 1, 9, 0, 0);

/** The code lifetime and purge delay of the spec, for fixtures that need realistic dates. */
const OTP_EXPIRY_MS = 10 * 60 * 1_000;
const OTP_PURGE_MS = 24 * 60 * 60 * 1_000;

export class NewUserFactory extends FixtureFactory<NewUser> {
  protected defaults(sequence: number): NewUser {
    return {
      email: `owner-${String(sequence)}@example.test`,
      passwordHash: `$argon2id$v=19$m=65536,t=3,p=4$fixture-salt-${String(sequence)}$fixture-hash`,
      displayName: `Owner ${String(sequence)}`,
    };
  }
}

export class AuthSessionFactory extends FixtureFactory<AuthSession> {
  protected defaults(sequence: number): AuthSession {
    return {
      jti: `jti-${String(sequence).padStart(4, '0')}`,
      // 64 hex characters, the shape of a SHA-256 digest.
      refreshTokenHash: String(sequence).padStart(64, 'a'),
      issuedAt: new Date(BASE_TIME_MS + sequence * 1_000),
    };
  }
}

export class OtpIssueFactory extends FixtureFactory<OtpIssue> {
  protected defaults(sequence: number): OtpIssue {
    const sentAt = new Date(BASE_TIME_MS + sequence * 60_000);
    return {
      userId: new Types.ObjectId().toString(),
      purpose: 'password_reset',
      identifier: String(sequence).padStart(64, 'f'),
      otpHash: `$2b$10$fixture${String(sequence).padStart(46, '0')}`,
      sentAt,
      expiresAt: new Date(sentAt.getTime() + OTP_EXPIRY_MS),
      purgeAt: new Date(sentAt.getTime() + OTP_PURGE_MS),
    };
  }
}
