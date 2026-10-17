/**
 * `ITokenIssuer` on JWT, HS256 (`owner-auth.T03`; spec → Session contract).
 *
 * Verification is done in two explicit steps rather than with one library call, because
 * refresh and logout must accept an expired token whose signature is valid:
 *   1. `compactVerify` checks the signature, with the algorithm pinned to HS256 — so an
 *      `alg: none` or RS256-confusion token is rejected before its payload is read;
 *   2. the payload must hold exactly `sub`, `jti`, `iat` and `exp`, and — unless
 *      `ignoreExpiry` — `exp` must not be more than the leeway in the past.
 * Any failure answers `null`; nothing about the reason leaves this class.
 */
import { compactVerify, SignJWT } from 'jose';
import { z } from 'zod';

import type {
  AccessTokenSubject,
  IClock,
  ITokenIssuer,
  VerifyAccessTokenOptions,
} from '../auth.interface.js';
import type { AccessTokenClaims } from '../auth.types.js';

/** The only accepted signing algorithm. */
const ALGORITHM = 'HS256';

/**
 * Shortest accepted secret. HS256 needs at least 256 bits of key; 32 characters is the floor,
 * and `openssl rand -base64 48` (the `.env.example` hint) gives 64.
 */
const MIN_SECRET_LENGTH = 32;

/** Exactly the four claims the spec allows — `strict` rejects any extra one. */
const claimsSchema = z.strictObject({
  sub: z.string().min(1),
  jti: z.string().min(1),
  iat: z.number().int().nonnegative(),
  exp: z.number().int().positive(),
});

export interface JwtTokenIssuerOptions {
  /** `JWT_ACCESS_SECRET`. Never logged. */
  readonly secret: string;
  /** Access-token lifetime in seconds (15 minutes). */
  readonly ttlSec: number;
  /** Clock skew tolerated on `exp` and `iat`, in seconds (30). */
  readonly leewaySec: number;
}

export class JwtTokenIssuer implements ITokenIssuer {
  private readonly key: Uint8Array;

  constructor(
    private readonly options: JwtTokenIssuerOptions,
    private readonly clock: IClock,
  ) {
    // Fails at container build, i.e. at startup, never on a request.
    if (options.secret.length < MIN_SECRET_LENGTH) {
      throw new Error(`JWT secret must be at least ${String(MIN_SECRET_LENGTH)} characters`);
    }
    this.key = new TextEncoder().encode(options.secret);
  }

  signAccessToken({ userId, jti }: AccessTokenSubject): Promise<string> {
    const iat = this.nowSec();
    return new SignJWT({})
      .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
      .setSubject(userId)
      .setJti(jti)
      .setIssuedAt(iat)
      .setExpirationTime(iat + this.options.ttlSec)
      .sign(this.key);
  }

  async verifyAccessToken(
    token: string,
    options: VerifyAccessTokenOptions = {},
  ): Promise<AccessTokenClaims | null> {
    let payload: unknown;
    try {
      const verified = await compactVerify(token, this.key, { algorithms: [ALGORITHM] });
      payload = JSON.parse(new TextDecoder().decode(verified.payload));
    } catch {
      return null;
    }

    const parsed = claimsSchema.safeParse(payload);
    if (!parsed.success) return null;
    const claims = parsed.data;

    const now = this.nowSec();
    // A token issued in the future was not issued by this clock (allowing for skew).
    if (claims.iat > now + this.options.leewaySec) return null;
    if (!options.ignoreExpiry && claims.exp + this.options.leewaySec < now) return null;
    return claims;
  }

  /** Whole seconds since the epoch, as JWT times are. */
  private nowSec(): number {
    return Math.floor(this.clock.now().getTime() / 1_000);
  }
}
