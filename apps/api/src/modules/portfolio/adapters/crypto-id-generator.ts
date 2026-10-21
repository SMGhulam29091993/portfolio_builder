/**
 * `IIdGenerator` on Node's `crypto` (`section-engine.T03`): 9 random bytes as 12 base64url
 * characters — 72 bits, unique with overwhelming probability within a list, and URL-safe. Used
 * instead of `nanoid` so no new dependency is needed (ADR-0007 unchanged).
 */
import { randomBytes } from 'node:crypto';

import type { IIdGenerator } from '../portfolio.interface.js';

const ID_BYTES = 9;

export class CryptoIdGenerator implements IIdGenerator {
  next(): string {
    return randomBytes(ID_BYTES).toString('base64url');
  }
}
