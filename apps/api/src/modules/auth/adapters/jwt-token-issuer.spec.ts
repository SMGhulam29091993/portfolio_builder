/**
 * `owner-auth.CT02` — the `ITokenIssuer` contract on `JwtTokenIssuer`, its one implementation.
 * Every rejection path the guard relies on (`owner-auth.AC5`) is pinned here, including tokens
 * forged with another secret, another algorithm or no signature at all.
 */
import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it } from 'vitest';

import { ManualClock } from '../../../testing/index.js';
import { JwtTokenIssuer } from './jwt-token-issuer.js';

const SECRET = 'test-secret-that-is-long-enough-for-hs256-0123456789';
const OTHER_SECRET = 'another-secret-that-is-long-enough-for-hs256-987654';
const TTL_SEC = 15 * 60;
const LEEWAY_SEC = 30;
const SUBJECT = { userId: '6a0000000000000000000001', jti: 'jti-abc' };

let clock: ManualClock;
let issuer: JwtTokenIssuer;

beforeEach(() => {
  clock = new ManualClock();
  issuer = new JwtTokenIssuer({ secret: SECRET, ttlSec: TTL_SEC, leewaySec: LEEWAY_SEC }, clock);
});

/** The current clock time in JWT seconds. */
function nowSec(): number {
  return Math.floor(clock.now().getTime() / 1_000);
}

/** Base64url of a JSON value, for hand-built tokens. */
function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

describe('owner-auth.CT02 — ITokenIssuer contract — JwtTokenIssuer', () => {
  it('round-trips: verify(sign(x)) returns exactly sub, jti, iat and exp = iat + 15 min', async () => {
    const token = await issuer.signAccessToken(SUBJECT);

    await expect(issuer.verifyAccessToken(token)).resolves.toStrictEqual({
      sub: SUBJECT.userId,
      jti: SUBJECT.jti,
      iat: nowSec(),
      exp: nowSec() + TTL_SEC,
    });
  });

  it('owner-auth.AC15 — carries no personal data: the payload has only the four claims', async () => {
    const token = await issuer.signAccessToken(SUBJECT);
    const [header = '', payload = ''] = token.split('.');

    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({
      alg: 'HS256',
      typ: 'JWT',
    });
    expect(Object.keys(JSON.parse(Buffer.from(payload, 'base64url').toString()) as object).sort()).toEqual(
      ['exp', 'iat', 'jti', 'sub'],
    );
  });

  it('owner-auth.AC5 — rejects an expired token, outside the leeway', async () => {
    const token = await issuer.signAccessToken(SUBJECT);

    clock.advance((TTL_SEC + LEEWAY_SEC + 1) * 1_000);

    await expect(issuer.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('accepts a token up to the 30-second leeway past expiry (spec → Edge Cases: clock skew)', async () => {
    const token = await issuer.signAccessToken(SUBJECT);

    clock.advance((TTL_SEC + LEEWAY_SEC - 1) * 1_000);

    await expect(issuer.verifyAccessToken(token)).resolves.not.toBeNull();
  });

  it('owner-auth.AC8 — with ignoreExpiry, accepts an expired token whose signature is valid', async () => {
    const token = await issuer.signAccessToken(SUBJECT);

    clock.advance(7 * 24 * 60 * 60 * 1_000);

    await expect(issuer.verifyAccessToken(token, { ignoreExpiry: true })).resolves.toMatchObject({
      sub: SUBJECT.userId,
      jti: SUBJECT.jti,
    });
  });

  it('owner-auth.AC5 — rejects a token signed with another secret, even with ignoreExpiry', async () => {
    const other = new JwtTokenIssuer({ secret: OTHER_SECRET, ttlSec: TTL_SEC, leewaySec: 30 }, clock);
    const token = await other.signAccessToken(SUBJECT);

    await expect(issuer.verifyAccessToken(token)).resolves.toBeNull();
    await expect(issuer.verifyAccessToken(token, { ignoreExpiry: true })).resolves.toBeNull();
  });

  it('owner-auth.AC5 — rejects a tampered payload', async () => {
    const [header, , signature] = (await issuer.signAccessToken(SUBJECT)).split('.');
    const forgedPayload = encodeSegment({
      sub: 'someone-else',
      jti: SUBJECT.jti,
      iat: nowSec(),
      exp: nowSec() + TTL_SEC,
    });

    await expect(
      issuer.verifyAccessToken(`${String(header)}.${forgedPayload}.${String(signature)}`),
    ).resolves.toBeNull();
  });

  it('rejects an unsigned token (alg: none)', async () => {
    const token = `${encodeSegment({ alg: 'none', typ: 'JWT' })}.${encodeSegment({
      sub: SUBJECT.userId,
      jti: SUBJECT.jti,
      iat: nowSec(),
      exp: nowSec() + TTL_SEC,
    })}.`;

    await expect(issuer.verifyAccessToken(token, { ignoreExpiry: true })).resolves.toBeNull();
  });

  it('rejects a token signed with the right secret but another algorithm (HS512)', async () => {
    const token = await new SignJWT({ jti: SUBJECT.jti })
      .setProtectedHeader({ alg: 'HS512' })
      .setSubject(SUBJECT.userId)
      .setIssuedAt(nowSec())
      .setExpirationTime(nowSec() + TTL_SEC)
      .sign(new TextEncoder().encode(SECRET));

    await expect(issuer.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('rejects a validly signed token that carries an extra claim', async () => {
    const token = await new SignJWT({ jti: SUBJECT.jti, email: 'owner@example.test' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(SUBJECT.userId)
      .setIssuedAt(nowSec())
      .setExpirationTime(nowSec() + TTL_SEC)
      .sign(new TextEncoder().encode(SECRET));

    await expect(issuer.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('rejects a token issued in the future beyond the leeway', async () => {
    const future = new JwtTokenIssuer(
      { secret: SECRET, ttlSec: TTL_SEC, leewaySec: LEEWAY_SEC },
      new ManualClock(new Date(clock.now().getTime() + 5 * 60 * 1_000)),
    );

    const token = await future.signAccessToken(SUBJECT);

    await expect(issuer.verifyAccessToken(token, { ignoreExpiry: true })).resolves.toBeNull();
  });

  it.each(['', 'not-a-jwt', 'a.b.c', 'a.b'])('answers null, never throws, for %j', async (token) => {
    await expect(issuer.verifyAccessToken(token)).resolves.toBeNull();
  });

  it('refuses a secret shorter than 32 characters at construction', () => {
    expect(
      () => new JwtTokenIssuer({ secret: 'short', ttlSec: TTL_SEC, leewaySec: LEEWAY_SEC }, clock),
    ).toThrow('at least 32 characters');
  });

  it('never puts the secret in an error message', () => {
    const shortSecret = 'too-short-secret-value';

    let message = '';
    try {
      new JwtTokenIssuer({ secret: shortSecret, ttlSec: TTL_SEC, leewaySec: 30 }, clock);
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain('at least 32 characters');
    expect(message).not.toContain(shortSecret);
  });
});
