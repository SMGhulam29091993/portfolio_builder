/**
 * SHA-256 as lower-case hex (`owner-auth.T03`).
 *
 * Used for refresh tokens, which are stored only as this digest (spec → Session contract). A
 * fast unsalted hash is right there: the token is 256 random bits, so it cannot be guessed or
 * looked up, and the digest only has to stop a Redis reader from replaying the raw value.
 * Low-entropy secrets — passwords, 6-digit codes — use the slow salted hashers instead.
 *
 * A pure helper with no state or I/O, which is why it may live in `core/` as a function
 * (`constitution.md` → Structural non-negotiable).
 */
import { createHash } from 'node:crypto';

/** The SHA-256 digest of `value` (UTF-8), as 64 lower-case hex characters. */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
