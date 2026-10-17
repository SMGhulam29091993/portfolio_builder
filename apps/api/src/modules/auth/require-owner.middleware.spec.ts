/**
 * `RequireOwnerMiddleware` on a test mount (`owner-auth.UT10`; AC4–AC6).
 *
 * The real `JwtTokenIssuer`, `SessionAuthorizer` and `SessionCookieWriter` run against the
 * in-memory session store and a manual clock, so expiry is reached by moving time, not by
 * waiting. The full stack against real Redis is `auth.routes.spec.ts`.
 */
import express, { type Express } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';

import { createErrorHandler } from '../../core/http/index.js';
import {
  AuthSessionFactory,
  InMemorySessionStore,
  ManualClock,
  RecordingLogger,
} from '../../testing/index.js';
import { JwtTokenIssuer } from './adapters/jwt-token-issuer.js';
import { RequireOwnerMiddleware } from './require-owner.middleware.js';
import { SessionAuthorizer } from './session-authorizer.service.js';
import { SessionCookieWriter } from './session-cookie-writer.js';

const SECRET = 'require-owner-spec-secret-0123456789abcdef';
const OTHER_SECRET = 'some-other-secret-0123456789abcdefghijkl';
const TOKEN_TTL_SEC = 15 * 60;
const LEEWAY_SEC = 30;
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;
const USER_ID = '65f0c0ffee0000000000abcd';

let clock: ManualClock;
let sessions: InMemorySessionStore;
let issuer: JwtTokenIssuer;
let app: Express;
/** User ids the protected handler saw; empty when the guard stopped the request. */
let handled: (string | undefined)[];

function issuerWith(secret: string): JwtTokenIssuer {
  return new JwtTokenIssuer({ secret, ttlSec: TOKEN_TTL_SEC, leewaySec: LEEWAY_SEC }, clock);
}

beforeEach(() => {
  clock = new ManualClock();
  sessions = new InMemorySessionStore({ ttlSec: SESSION_TTL_SEC }, () => clock.now().getTime());
  issuer = issuerWith(SECRET);
  const cookies = new SessionCookieWriter(
    { NODE_ENV: 'test' },
    { apiPath: '/api/v1', authPath: '/api/v1/auth', maxAgeSec: SESSION_TTL_SEC },
  );
  const guard = new RequireOwnerMiddleware(new SessionAuthorizer(issuer, sessions), cookies);

  handled = [];
  app = express();
  app.get('/api/v1/cms/probe', guard.handle, (req, res) => {
    handled.push(req.auth?.userId);
    res.json({ userId: req.auth?.userId });
  });
  app.use(createErrorHandler(new RecordingLogger()));
});

/** Stores a session for `USER_ID` and returns a signed token naming it. */
async function signIn(jti = 'jti-current'): Promise<string> {
  await sessions.replace(USER_ID, new AuthSessionFactory().build({ jti }));
  return issuer.signAccessToken({ userId: USER_ID, jti });
}

function probe(cookie?: string): request.Test {
  const call = request(app).get('/api/v1/cms/probe');
  return cookie === undefined ? call : call.set('Cookie', cookie);
}

/** Expects a 401 with `code`, and that the handler behind the guard never ran. */
function expectRejected(response: request.Response, code: string): void {
  expect(response.status).toBe(401);
  expect(response.body).toEqual({
    success: false,
    message: expect.any(String) as unknown,
    data: { code },
  });
  expect(handled).toEqual([]);
}

describe('RequireOwnerMiddleware', () => {
  it('owner-auth.AC4 — sets req.auth.userId and runs the handler when all three jti values match', async () => {
    const token = await signIn();

    const response = await probe(`access-token=${token}; jti=jti-current`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: USER_ID });
    expect(handled).toEqual([USER_ID]);
  });

  it('owner-auth.AC5 — 401 UNAUTHENTICATED without an access-token cookie', async () => {
    expectRejected(await probe(), 'UNAUTHENTICATED');
  });

  it('owner-auth.UT10 — 401 UNAUTHENTICATED for an expired token (past the 30 s leeway)', async () => {
    const token = await signIn();
    clock.advance((TOKEN_TTL_SEC + LEEWAY_SEC + 1) * 1_000);

    expectRejected(await probe(`access-token=${token}; jti=jti-current`), 'UNAUTHENTICATED');
  });

  it('owner-auth.UT10 — 401 UNAUTHENTICATED for a tampered token', async () => {
    const token = await signIn();
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'someone-else', jti: 'jti-current', iat: 0, exp: 9e9 })).toString('base64url');

    expectRejected(
      await probe(`access-token=${String(header)}.${forged}.${String(signature)}; jti=jti-current`),
      'UNAUTHENTICATED',
    );
  });

  it('owner-auth.UT10 — 401 UNAUTHENTICATED for a token signed with another secret', async () => {
    await signIn();
    const foreign = await issuerWith(OTHER_SECRET).signAccessToken({ userId: USER_ID, jti: 'jti-current' });

    expectRejected(await probe(`access-token=${foreign}; jti=jti-current`), 'UNAUTHENTICATED');
  });

  it('owner-auth.AC5 — 401 UNAUTHENTICATED when no session exists for the token sub', async () => {
    const token = await signIn();
    await sessions.delete(USER_ID);

    expectRejected(await probe(`access-token=${token}; jti=jti-current`), 'UNAUTHENTICATED');
  });

  it('does not clear cookies on UNAUTHENTICATED, so an expired access token can still be refreshed', async () => {
    const token = await signIn();
    clock.advance((TOKEN_TTL_SEC + LEEWAY_SEC + 1) * 1_000);

    const response = await probe(`access-token=${token}; jti=jti-current`);

    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it.each([
    ['the jti cookie differs from the token', 'jti-current', 'jti-tampered'],
    ['the stored session moved on', 'jti-newer', 'jti-current'],
  ])(
    'owner-auth.AC6 — 401 SESSION_EXPIRED when %s, clearing all three cookies and leaving the session',
    async (_case, storedJti, cookieJti) => {
      const token = await issuer.signAccessToken({ userId: USER_ID, jti: 'jti-current' });
      await sessions.replace(USER_ID, new AuthSessionFactory().build({ jti: storedJti }));
      const before = await sessions.get(USER_ID);

      const response = await probe(`access-token=${token}; jti=${cookieJti}`);

      expectRejected(response, 'SESSION_EXPIRED');
      const cleared = (response.headers['set-cookie'] as unknown as string[]).map((line) =>
        line.slice(0, line.indexOf('=')),
      );
      expect(cleared.sort()).toEqual(['access-token', 'jti', 'refresh-token']);
      expect(await sessions.get(USER_ID)).toEqual(before);
    },
  );
});
