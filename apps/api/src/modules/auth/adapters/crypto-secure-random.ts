/**
 * `ISecureRandom` on `node:crypto` (`owner-auth.T03`). Every value comes from the operating
 * system's CSPRNG; `Math.random` is never used for anything security-relevant.
 */
import { randomBytes, randomInt } from 'node:crypto';

import type { ISecureRandom } from '../auth.interface.js';

/** `randomInt` accepts ranges below 2^48; 14 digits stay well within it. */
const MAX_CODE_LENGTH = 14;

export class CryptoSecureRandom implements ISecureRandom {
  base64url(byteLength: number): string {
    return randomBytes(byteLength).toString('base64url');
  }

  hex(byteLength: number): string {
    return randomBytes(byteLength).toString('hex');
  }

  /**
   * One uniform draw over `[0, 10^length)`, zero-padded — the spec's
   * `crypto.randomInt(0, 1_000_000)` for six digits. `randomInt` rejects modulo bias itself.
   */
  numericCode(length: number): string {
    if (!Number.isInteger(length) || length < 1 || length > MAX_CODE_LENGTH) {
      throw new RangeError(`code length must be 1-${String(MAX_CODE_LENGTH)}`);
    }
    return String(randomInt(0, 10 ** length)).padStart(length, '0');
  }
}
