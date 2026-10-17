/**
 * Service tests for `SessionAuthorizer` — the `jti` triple match (spec → Request authorization;
 * `owner-auth.UT04`, `UT05`). The session store is the in-memory fake that passes the Redis
 * store's contract suite (`owner-auth.CT03`); no datastore is touched.
 *
 * Tokens come from the real `JwtTokenIssuer` on a `ManualClock`: it is pure computation with no
 * I/O, and using it means the expired, tampered and wrong-secret cases are the real ones the
 * guard will meet rather than a fake's imitation of them.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { AuthSessionFactory, InMemorySessionStore, ManualClock } from '../../testing/index.js';
import { JwtTokenIssuer } from './adapters/jwt-token-issuer.js';
import { SessionExpiredError } from './auth.errors.js';
import type { AuthSession } from './auth.types.js';
import { SessionAuthorizer } from './session-authorizer.service.js';

const SECRET = 'test-secret-that-is-long-enough-for-hs256-0123456789';
const OTHER_SECRET = 'another-secret-that-is-long-enough-for-hs256-987654';
const ACCESS_TTL_SEC = 15 * 60;
const LEEWAY_SEC = 30;
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;
const USER_ID = '6a0000000000000000000001';

let clock: ManualClock;
let sessions: InMemorySessionStore;
let issuer: JwtTokenIssuer;
let authorizer: SessionAuthorizer;
let session: AuthSession;
let accessToken: string;

beforeEach(async () => {
  clock = new ManualClock();
  sessions = new InMemorySessionStore({ ttlSec: SESSION_TTL_SEC }, () => clock.now().getTime());
  issuer = new JwtTokenIssuer(
    { secret: SECRET, ttlSec: ACCESS_TTL_SEC, leewaySec: LEEWAY_SEC },
    clock,
  );
  authorizer = new SessionAuthorizer(issuer, sessions);

  // A signed-in user: a stored session and an access token carrying its `jti`.
  session = new AuthSessionFactory().build();
  await sessions.replace(USER_ID, session);
  accessToken = await issuer.signAccessToken({ userId: USER_ID, jti: session.jti });
});

describe('SessionAuthorizer.authorize', () => {
  it('owner-auth.UT04 — returns the user id and session when token, cookie and session agree', async () => {
    await expect(authorizer.authorize({ accessToken, jti: session.jti })).resolves.toEqual({
      userId: USER_ID,
      session,
    });
  });

  it('owner-auth.UT04 — throws UNAUTHENTICATED when no session exists for the token sub', async () => {
    await sessions.delete(USER_ID);

    await expect(authorizer.authorize({ accessToken, jti: session.jti })).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('owner-auth.AC5 — throws UNAUTHENTICATED when the access token is absent', async () => {
    await expect(authorizer.authorize({ jti: session.jti })).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('owner-auth.AC5 — throws UNAUTHENTICATED for a malformed, tampered or wrong-secret token', async () => {
    const [header, , signature] = accessToken.split('.');
    const tampered = [
      header,
      Buffer.from(JSON.stringify({ sub: 'someone-else', jti: session.jti })).toString('base64url'),
      signature,
    ].join('.');
    const otherIssuer = new JwtTokenIssuer(
      { secret: OTHER_SECRET, ttlSec: ACCESS_TTL_SEC, leewaySec: LEEWAY_SEC },
      clock,
    );
    const wrongSecret = await otherIssuer.signAccessToken({ userId: USER_ID, jti: session.jti });

    for (const token of ['not-a-jwt', tampered, wrongSecret]) {
      await expect(
        authorizer.authorize({ accessToken: token, jti: session.jti }),
      ).rejects.toBeInstanceOf(UnauthenticatedError);
    }
  });

  it('owner-auth.AC5 — throws UNAUTHENTICATED for an expired token', async () => {
    clock.advance((ACCESS_TTL_SEC + LEEWAY_SEC + 1) * 1_000);

    await expect(authorizer.authorize({ accessToken, jti: session.jti })).rejects.toBeInstanceOf(
      UnauthenticatedError,
    );
  });

  it('accepts an expired token with ignoreExpiry (refresh and logout only)', async () => {
    clock.advance((ACCESS_TTL_SEC + LEEWAY_SEC + 1) * 1_000);

    await expect(
      authorizer.authorize({ accessToken, jti: session.jti }, { ignoreExpiry: true }),
    ).resolves.toEqual({ userId: USER_ID, session });
  });

  it('owner-auth.UT05 — throws SESSION_EXPIRED when the token jti differs from the cookie, store untouched', async () => {
    const result = authorizer.authorize({ accessToken, jti: 'jti-from-another-browser' });

    await expect(result).rejects.toBeInstanceOf(SessionExpiredError);
    await expect(result).rejects.toMatchObject({ status: 401, code: 'SESSION_EXPIRED' });
    await expect(sessions.get(USER_ID)).resolves.toEqual(session);
  });

  it('owner-auth.UT05 — throws SESSION_EXPIRED when cookie and token agree but the session moved on, store untouched', async () => {
    const newer = new AuthSessionFactory().build({ jti: 'jti-newer-sign-in' });
    await sessions.replace(USER_ID, newer);

    await expect(authorizer.authorize({ accessToken, jti: session.jti })).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
    await expect(sessions.get(USER_ID)).resolves.toEqual(newer);
  });

  it('owner-auth.AC6 — throws SESSION_EXPIRED when the jti cookie is missing', async () => {
    await expect(authorizer.authorize({ accessToken })).rejects.toBeInstanceOf(
      SessionExpiredError,
    );
  });
});
