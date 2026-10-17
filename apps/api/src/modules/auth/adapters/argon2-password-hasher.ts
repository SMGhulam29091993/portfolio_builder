/**
 * `IPasswordHasher` on argon2id (`owner-auth.T03`; ADR-0007).
 *
 * Parameters are pinned here rather than left to the library's defaults, so an `argon2`
 * upgrade cannot silently change them: 64 MiB memory, 3 passes, 4 lanes. Measured at ~33 ms
 * per hash and per verify on the development machine (2026-10-17; recorded in the plan), above
 * the OWASP minimum (19 MiB, 2 passes) and cheap enough for a single owner's sign-ins. Each
 * hash is a PHC string carrying its own parameters, so raising them later keeps every stored
 * hash verifiable.
 */
import argon2 from 'argon2';

import type { IPasswordHasher } from '../auth.interface.js';

/** argon2id cost parameters (see the file header). */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
} as const;

export class Argon2PasswordHasher implements IPasswordHasher {
  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  /** The comparison inside `argon2.verify` is constant-time. */
  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }
}
