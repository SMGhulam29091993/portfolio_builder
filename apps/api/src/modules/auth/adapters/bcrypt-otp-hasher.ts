/**
 * `IOtpHasher` on bcrypt, cost 10 (`owner-auth.T03`; ADR-0007 — the owner's choice for codes
 * and references). `bcryptjs` is pure JavaScript, so there is no native build.
 *
 * Inputs are short: a 6-digit code, or a 64-character identifier for a reference — both well
 * under bcrypt's 72-byte input limit, so no input is silently truncated.
 */
import { compare, hash } from 'bcryptjs';

import type { IOtpHasher } from '../auth.interface.js';

/** bcrypt cost factor (2^10 rounds). */
const BCRYPT_COST = 10;

/** bcrypt reads at most this many bytes of its input. */
const BCRYPT_MAX_INPUT_BYTES = 72;

export class BcryptOtpHasher implements IOtpHasher {
  hash(value: string): Promise<string> {
    // Refuse rather than truncate: two inputs sharing their first 72 bytes would otherwise
    // hash alike. No caller in this module comes close to the limit.
    if (Buffer.byteLength(value, 'utf8') > BCRYPT_MAX_INPUT_BYTES) {
      return Promise.reject(new Error('bcrypt input exceeds 72 bytes'));
    }
    return hash(value, BCRYPT_COST);
  }

  async compare(value: string, hashed: string): Promise<boolean> {
    try {
      return await compare(value, hashed);
    } catch {
      // A malformed stored hash can never match; answering false keeps the caller's single
      // "invalid code" path (spec → Error Handling: one OTP_INVALID body).
      return false;
    }
  }
}
