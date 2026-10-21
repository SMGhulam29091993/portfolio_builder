/**
 * Constant-time equality for secrets compared against configuration — the owner registration
 * secret (`account-registration` → Roles and the owner claim).
 *
 * Both values are hashed to SHA-256 first, so the comparison always runs over two 32-byte
 * digests: neither the length of the configured secret nor the position of the first differing
 * character changes how long it takes. A pure helper, so it may live in `core/` as a function
 * (`constitution.md` → Structural non-negotiable).
 */
import { createHash, timingSafeEqual } from 'node:crypto';

/** `true` when `given` equals `expected`, compared without a timing side channel. */
export function constantTimeEquals(given: string, expected: string): boolean {
  const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();
  return timingSafeEqual(digest(given), digest(expected));
}
