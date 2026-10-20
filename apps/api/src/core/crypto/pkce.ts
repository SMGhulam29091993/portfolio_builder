/**
 * PKCE S256 (RFC 7636): the challenge is `BASE64URL(SHA-256(code_verifier))`, without padding
 * (`google-sign-in` → Flow, step 1). A pure helper, so it may live in `core/` as a function.
 */
import { createHash } from 'node:crypto';

/** The S256 code challenge for `verifier`. */
export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}
