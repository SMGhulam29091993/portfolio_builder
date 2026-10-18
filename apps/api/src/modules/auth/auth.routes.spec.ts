/**
 * `owner-auth.API01`–`API04` and `requireOwner` end to end: the real container and app over
 * real HTTP, a real `mongod` and a real Redis (`owner-auth.T05`; IT01–IT11, IT23; AC1, AC2,
 * AC4–AC11, AC15), plus the login rate limit and the Origin allow-list (`owner-auth.T06`; IT03,
 * IT12; AC3, AC12).
 *
 * Every non-GET request sends `Origin: WEB_ORIGIN`, as the browser does through the web app;
 * IT12 leaves it out or changes it on purpose.
 *
 * The container gets a `ManualClock`, so an access token expires by moving time (IT08) while
 * Redis TTLs still run on real time. No `/cms` module exists yet, so a probe route behind the
 * container's guard stands in for one (AC4–AC7); `GET /auth/me` proves the same guard on a
 * shipped route.
 *
 * Every cookie value, the password and the email seen during the run are collected and must not
 * appear in any log line (`owner-auth.AC15`).
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import { sha256Hex } from '../../core/crypto/sha256.js';
import { ApiRouter, ok } from '../../core/http/index.js';
import {
  ManualClock,
  MongoTestHarness,
  RecordingLogger,
  RedisTestHarness,
} from '../../testing/index.js';
import { Argon2PasswordHasher } from './adapters/argon2-password-hasher.js';
import { JwtTokenIssuer } from './adapters/jwt-token-issuer.js';
import { UserRepository } from './user.repository.js';

const JWT_SECRET = 'auth-routes-spec-placeholder-secret-00000';
const OWNER_EMAIL = 'owner@example.test';
const OWNER_PASSWORD = 'correct horse battery staple';
/** The web app's origin for this run: the only one allowed to send a non-GET. */
const WEB_ORIGIN = 'http://127.0.0.1:3100';
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;
/** Past the 15-minute token lifetime and its 30-second leeway. */
const PAST_TOKEN_EXPIRY_MS = (15 * 60 + 31) * 1_000;

/** The three session cookies as name → value. */
type CookieJar = Record<'access-token' | 'jti' | 'refresh-token', string>;

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let clock: ManualClock;
let logger: RecordingLogger;
let api: ApiApplication;
let ownerId: string;
/** Every secret value the run produced, for the log check at the end (AC15). */
const secrets = new Set<string>([OWNER_EMAIL, OWNER_PASSWORD]);

/**
 * A fresh container and app over the shared datastores, with the probe route behind the guard.
 * Each call has its own rate-limit counters, so a test that exhausts the login limit (IT03) can
 * do it without locking every other test out.
 */
function buildApi(): ApiApplication {
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '4100',
    MONGODB_URI: mongo.uri,
    REDIS_URL: redis.url,
    JWT_ACCESS_SECRET: JWT_SECRET,
    WEB_ORIGIN,
  });
  const container = buildContainer({
    env,
    logger,
    mongo: mongo.connection,
    redis: redis.connection,
    clock,
  });
  const probe = new ApiRouter().route('get', '/cms/probe', container.authGuard, (req, res) => {
    ok(res, 'probe', { userId: req.auth?.userId });
  });
  return createApp({ ...container, apiRouters: [...container.apiRouters, probe] });
}

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  clock = new ManualClock(new Date());
  logger = new RecordingLogger();
  api = buildApi();

  // The owner seeder is `owner-auth.T09`; until then the test writes the user directly.
  const owner = await new UserRepository(mongo.connection).create({
    email: OWNER_EMAIL,
    passwordHash: await new Argon2PasswordHasher().hash(OWNER_PASSWORD),
    displayName: 'Owner',
  });
  ownerId = owner.id;
});

afterEach(async () => {
  await redis.reset();
});

afterAll(async () => {
  await mongo.stop();
  await redis.stop();
});

/** The `Set-Cookie` lines of a response, keyed by cookie name. */
function setCookieLines(response: request.Response): Map<string, string> {
  const lines = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return new Map(lines.map((line) => [line.slice(0, line.indexOf('=')), line]));
}

/** The cookie values a response set; the values are remembered for the AC15 check. */
function jarFrom(response: request.Response): CookieJar {
  const values = Object.fromEntries(
    [...setCookieLines(response)].map(([name, line]) => [
      name,
      line.slice(name.length + 1, line.indexOf(';')),
    ]),
  );
  const jar = values as CookieJar;
  for (const value of Object.values(jar)) secrets.add(value);
  return jar;
}

/** Names of the cookies a response cleared (empty value, expired). */
function clearedCookies(response: request.Response): string[] {
  return [...setCookieLines(response)]
    .filter(([, line]) => line.includes('Expires=Thu, 01 Jan 1970'))
    .map(([name]) => name)
    .sort();
}

/** The `Cookie` header a browser sends to `/api/v1/auth/**`: all three cookies. */
function authCookies(jar: CookieJar): string {
  return `access-token=${jar['access-token']}; jti=${jar.jti}; refresh-token=${jar['refresh-token']}`;
}

/** The `Cookie` header a browser sends to `/api/v1/cms/**`: the refresh token stays behind. */
function cmsCookies(jar: Pick<CookieJar, 'access-token' | 'jti'>): string {
  return `access-token=${jar['access-token']}; jti=${jar.jti}`;
}

function login(email = OWNER_EMAIL, password = OWNER_PASSWORD, app = api): request.Test {
  return request(app.handler)
    .post('/api/v1/auth/login')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password });
}

/** Signs in and returns the cookies, failing the test if sign-in did not succeed. */
async function signIn(): Promise<CookieJar> {
  const response = await login();
  expect(response.status).toBe(200);
  return jarFrom(response);
}

function probe(cookie?: string): request.Test {
  const call = request(api.handler).get('/api/v1/cms/probe');
  return cookie === undefined ? call : call.set('Cookie', cookie);
}

function refresh(cookie?: string): request.Test {
  const call = request(api.handler).post('/api/v1/auth/refresh').set('Origin', WEB_ORIGIN);
  return cookie === undefined ? call : call.set('Cookie', cookie);
}

function logout(cookie?: string): request.Test {
  const call = request(api.handler).post('/api/v1/auth/logout').set('Origin', WEB_ORIGIN);
  return cookie === undefined ? call : call.set('Cookie', cookie);
}

/** The owner's stored session hash, or `{}` when there is none. */
function storedSession(): Promise<Record<string, string>> {
  return redis.connection.getClient().hGetAll(`auth:session:${ownerId}`);
}

function expectError(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    success: false,
    message: expect.any(String) as unknown,
    data: expect.objectContaining({ code }) as unknown,
  });
}

const OWNER_USER = () => ({ id: ownerId, email: OWNER_EMAIL, displayName: 'Owner' });

describe('POST /api/v1/auth/login (owner-auth.API01)', () => {
  it('owner-auth.IT01 / AC1 — 200 with the user only, three cookies with the contract attributes, and the session in Redis', async () => {
    const response = await login();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Signed in',
      data: { user: OWNER_USER() },
    });

    const jar = jarFrom(response);
    const lines = setCookieLines(response);
    expect([...lines.keys()].sort()).toEqual(['access-token', 'jti', 'refresh-token']);
    for (const line of lines.values()) {
      expect(line).toContain('HttpOnly');
      expect(line).toContain('SameSite=Lax');
      expect(line).toContain(`Max-Age=${String(SESSION_TTL_SEC)}`);
    }
    expect(lines.get('access-token')).toContain('Path=/api/v1;');
    expect(lines.get('jti')).toContain('Path=/api/v1;');
    expect(lines.get('refresh-token')).toContain('Path=/api/v1/auth;');

    // No token in the body (spec → Session contract).
    const body = JSON.stringify(response.body);
    for (const value of Object.values(jar)) expect(body).not.toContain(value);

    const session = await storedSession();
    expect(session.jti).toBe(jar.jti);
    expect(session.refreshTokenHash).toBe(sha256Hex(jar['refresh-token']));
    expect(await redis.connection.getClient().ttl(`auth:session:${ownerId}`)).toBeGreaterThan(
      SESSION_TTL_SEC - 5,
    );
  });

  it('owner-auth.IT02 / AC2 — a wrong password and an unknown email get byte-identical 401 bodies', async () => {
    const wrongPassword = await login(OWNER_EMAIL, 'not the password');
    const unknownEmail = await login('nobody@example.test', OWNER_PASSWORD);

    expectError(wrongPassword, 401, 'UNAUTHENTICATED');
    expect(unknownEmail.status).toBe(401);
    expect(unknownEmail.text).toBe(wrongPassword.text);
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
    expect(await storedSession()).toEqual({});
  });

  it('owner-auth.IT23 — accepts the email in mixed case', async () => {
    const response = await login('Owner@Example.TEST');

    expect(response.status).toBe(200);
    jarFrom(response);
  });

  it('400 VALIDATION_FAILED for a body that fails the schema, before any credential check', async () => {
    const response = await request(api.handler)
      .post('/api/v1/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email: 'not-an-email', password: '' });

    expectError(response, 400, 'VALIDATION_FAILED');
  });

  it('owner-auth.IT03 / AC3 — after 5 failed sign-ins for one IP + email the sixth is 429 even with the right password; another email is not limited', async () => {
    const limitedApi = buildApi();

    // A success before the failures does not count towards them.
    expect((await login(OWNER_EMAIL, OWNER_PASSWORD, limitedApi)).status).toBe(200);
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      // Case differences are one email, as for the lookup.
      const email = attempt % 2 === 0 ? OWNER_EMAIL.toUpperCase() : OWNER_EMAIL;
      expectError(await login(email, 'not the password', limitedApi), 401, 'UNAUTHENTICATED');
    }

    const sixth = await login(OWNER_EMAIL, OWNER_PASSWORD, limitedApi);
    expectError(sixth, 429, 'RATE_LIMITED');
    expect(sixth.headers['retry-after']).toBe(String(15 * 60));
    expect(sixth.headers['set-cookie']).toBeUndefined();

    // Same IP, different email: its own count.
    expectError(await login('nobody@example.test', OWNER_PASSWORD, limitedApi), 401, 'UNAUTHENTICATED');

    // The window is 15 minutes from the first attempt; after it the owner signs in again.
    clock.advance(15 * 60 * 1_000);
    expect((await login(OWNER_EMAIL, OWNER_PASSWORD, limitedApi)).status).toBe(200);
  });
});

describe('Origin allow-list on /api/v1/auth and /api/v1/cms (owner-auth.AC12)', () => {
  it('owner-auth.IT12 / AC12 — POST login with no Origin, and with a foreign Origin, is 403 ORIGIN_NOT_ALLOWED', async () => {
    const body = { email: OWNER_EMAIL, password: OWNER_PASSWORD };

    const missing = await request(api.handler).post('/api/v1/auth/login').send(body);
    const foreign = await request(api.handler)
      .post('/api/v1/auth/login')
      .set('Origin', 'https://attacker.example')
      .send(body);

    for (const response of [missing, foreign]) {
      expectError(response, 403, 'ORIGIN_NOT_ALLOWED');
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    expect(await storedSession()).toEqual({});
  });

  it('owner-auth.AC12 — refuses before authentication: refresh and logout with genuine cookies but a foreign Origin are 403 and change nothing', async () => {
    const jar = await signIn();
    const before = await storedSession();

    for (const path of ['/api/v1/auth/refresh', '/api/v1/auth/logout']) {
      const response = await request(api.handler)
        .post(path)
        .set('Origin', 'https://attacker.example')
        .set('Cookie', authCookies(jar));
      expectError(response, 403, 'ORIGIN_NOT_ALLOWED');
      expect(response.headers['set-cookie']).toBeUndefined();
    }
    expect(await storedSession()).toEqual(before);
  });

  it('owner-auth.AC12 — covers every non-GET under /cms, even a path no route serves yet', async () => {
    expectError(await request(api.handler).post('/api/v1/cms/anything'), 403, 'ORIGIN_NOT_ALLOWED');
    // GET is not checked: it reaches the guard (no cookie → 401).
    expectError(await probe(), 401, 'UNAUTHENTICATED');
  });

  it('owner-auth.AC12 — a refused body is not validated, rate limited or counted', async () => {
    // Six refused attempts with a wrong password: none reaches the limiter, so the right
    // password still signs in from the web origin afterwards.
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(api.handler)
        .post('/api/v1/auth/login')
        .send({ email: OWNER_EMAIL, password: 'not the password' });
      expectError(response, 403, 'ORIGIN_NOT_ALLOWED');
    }
    expect((await login()).status).toBe(200);
  });
});

describe('requireOwner on a /cms route and GET /api/v1/auth/me (owner-auth.API04)', () => {
  it('owner-auth.IT04 / AC4 — the handler runs with req.auth.userId equal to the owner id', async () => {
    const jar = await signIn();

    const response = await probe(cmsCookies(jar));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'probe', data: { userId: ownerId } });
  });

  it('owner-auth.API04 — answers the signed-in user', async () => {
    const jar = await signIn();

    const response = await request(api.handler)
      .get('/api/v1/auth/me')
      .set('Cookie', cmsCookies(jar));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Current user',
      data: { user: OWNER_USER() },
    });
  });

  it('owner-auth.IT05 / AC5 — 401 UNAUTHENTICATED with no cookie, on the probe and on /me', async () => {
    expectError(await probe(), 401, 'UNAUTHENTICATED');
    expectError(await request(api.handler).get('/api/v1/auth/me'), 401, 'UNAUTHENTICATED');
  });

  it('owner-auth.IT05 / AC5 — 401 UNAUTHENTICATED for an expired access token', async () => {
    const jar = await signIn();
    clock.advance(PAST_TOKEN_EXPIRY_MS);

    expectError(await probe(cmsCookies(jar)), 401, 'UNAUTHENTICATED');
  });

  it('owner-auth.IT05 / AC5 — 401 UNAUTHENTICATED for a tampered access token', async () => {
    const jar = await signIn();
    const [header, payload = '', signature] = jar['access-token'].split('.');
    // Flip one character of the payload: the signature no longer matches.
    const tampered = `${String(header)}.${payload.slice(0, -1)}${payload.endsWith('A') ? 'B' : 'A'}.${String(signature)}`;

    expectError(await probe(cmsCookies({ ...jar, 'access-token': tampered })), 401, 'UNAUTHENTICATED');
  });

  it('owner-auth.IT05 / AC5 — 401 UNAUTHENTICATED for a token signed with another secret', async () => {
    const jar = await signIn();
    const foreign = await new JwtTokenIssuer(
      { secret: 'a-different-secret-entirely-0123456789', ttlSec: 900, leewaySec: 30 },
      clock,
    ).signAccessToken({ userId: ownerId, jti: jar.jti });

    expectError(await probe(cmsCookies({ ...jar, 'access-token': foreign })), 401, 'UNAUTHENTICATED');
  });

  it('owner-auth.IT05 / AC5 — 401 UNAUTHENTICATED once the Redis session is gone', async () => {
    const jar = await signIn();
    await redis.connection.getClient().del(`auth:session:${ownerId}`);

    expectError(await probe(cmsCookies(jar)), 401, 'UNAUTHENTICATED');
  });

  it('owner-auth.IT06 / AC6 — SESSION_EXPIRED for an altered jti cookie: three cookies cleared, session unchanged', async () => {
    const jar = await signIn();
    const before = await storedSession();

    const response = await probe(cmsCookies({ ...jar, jti: 'altered-jti' }));

    expectError(response, 401, 'SESSION_EXPIRED');
    expect(clearedCookies(response)).toEqual(['access-token', 'jti', 'refresh-token']);
    expect(await storedSession()).toEqual(before);
  });

  it('owner-auth.IT06 / AC6 — SESSION_EXPIRED when the stored session jti changed: cookies cleared, session unchanged', async () => {
    const jar = await signIn();
    await redis.connection.getClient().hSet(`auth:session:${ownerId}`, 'jti', 'newer-jti');
    const before = await storedSession();

    const response = await probe(cmsCookies(jar));

    expectError(response, 401, 'SESSION_EXPIRED');
    expect(clearedCookies(response)).toEqual(['access-token', 'jti', 'refresh-token']);
    expect(await storedSession()).toEqual(before);
  });

  it('owner-auth.IT07 / AC7 — a sign-in on browser B ends browser A', async () => {
    const browserA = await signIn();
    const browserB = await signIn();

    expectError(await probe(cmsCookies(browserA)), 401, 'SESSION_EXPIRED');
    expect((await probe(cmsCookies(browserB))).status).toBe(200);
  });
});

describe('POST /api/v1/auth/refresh (owner-auth.API02)', () => {
  it('owner-auth.IT08 / AC8 — rotates all three values after the access token expired; the old cookies then fail', async () => {
    const first = await signIn();
    // Shorten the TTL, so the refresh visibly resets it to 7 days.
    await redis.connection.getClient().expire(`auth:session:${ownerId}`, 60);
    clock.advance(PAST_TOKEN_EXPIRY_MS);
    expectError(await probe(cmsCookies(first)), 401, 'UNAUTHENTICATED');

    const response = await refresh(authCookies(first));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      message: 'Session refreshed',
      data: { user: OWNER_USER() },
    });
    const second = jarFrom(response);
    expect(second['access-token']).not.toBe(first['access-token']);
    expect(second.jti).not.toBe(first.jti);
    expect(second['refresh-token']).not.toBe(first['refresh-token']);

    const session = await storedSession();
    expect(session.jti).toBe(second.jti);
    expect(session.refreshTokenHash).toBe(sha256Hex(second['refresh-token']));
    expect(await redis.connection.getClient().ttl(`auth:session:${ownerId}`)).toBeGreaterThan(
      SESSION_TTL_SEC - 5,
    );

    expect((await probe(cmsCookies(second))).status).toBe(200);
    const replay = await refresh(authCookies(first));
    expectError(replay, 401, 'SESSION_EXPIRED');
    expect(clearedCookies(replay)).toEqual(['access-token', 'jti', 'refresh-token']);
    // The replay did not end the rotated session.
    expect((await storedSession()).jti).toBe(second.jti);
  });

  it('owner-auth.IT09 / AC9 — a wrong refresh token with a matching jti deletes the session; the genuine cookies then fail too', async () => {
    const jar = await signIn();

    const forged = await refresh(authCookies({ ...jar, 'refresh-token': 'forged-refresh-token' }));

    expectError(forged, 401, 'UNAUTHENTICATED');
    expect(clearedCookies(forged)).toEqual(['access-token', 'jti', 'refresh-token']);
    expect(await storedSession()).toEqual({});
    expectError(await refresh(authCookies(jar)), 401, 'UNAUTHENTICATED');
  });

  it('owner-auth.AC9 — an absent refresh-token cookie is treated like a wrong one', async () => {
    const jar = await signIn();

    expectError(await refresh(cmsCookies(jar)), 401, 'UNAUTHENTICATED');
    expect(await storedSession()).toEqual({});
  });

  it('owner-auth.API02 — 401 UNAUTHENTICATED with cookies cleared when there are no cookies at all', async () => {
    const response = await refresh();

    expectError(response, 401, 'UNAUTHENTICATED');
    expect(clearedCookies(response)).toEqual(['access-token', 'jti', 'refresh-token']);
  });

  it('owner-auth.IT10 / AC10 — of two refreshes sent together with one set of cookies, exactly one succeeds', async () => {
    const jar = await signIn();

    const responses = await Promise.all([refresh(authCookies(jar)), refresh(authCookies(jar))]);

    const statuses = responses.map((response) => response.status).sort();
    expect(statuses).toEqual([200, 401]);
    const loser = responses.find((response) => response.status === 401);
    const winner = responses.find((response) => response.status === 200);
    expect(loser?.body).toEqual(
      expect.objectContaining({ data: { code: 'SESSION_EXPIRED' } }),
    );
    if (winner) {
      const rotated = jarFrom(winner);
      expect((await storedSession()).jti).toBe(rotated.jti);
    }
  });
});

describe('POST /api/v1/auth/logout (owner-auth.API03)', () => {
  it('owner-auth.IT11 / AC11 — deletes the session and clears the cookies; a refresh with the old cookies is UNAUTHENTICATED', async () => {
    const jar = await signIn();

    const response = await logout(authCookies(jar));

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'Signed out' });
    expect(clearedCookies(response)).toEqual(['access-token', 'jti', 'refresh-token']);
    expect(await storedSession()).toEqual({});
    expectError(await refresh(authCookies(jar)), 401, 'UNAUTHENTICATED');
  });

  it('owner-auth.IT11 / AC11 — a superseded browser signing out leaves the newer session alone', async () => {
    const browserA = await signIn();
    const browserB = await signIn();

    const response = await logout(authCookies(browserA));

    expect(response.status).toBe(200);
    expect((await storedSession()).jti).toBe(browserB.jti);
    expect((await probe(cmsCookies(browserB))).status).toBe(200);
  });

  it('owner-auth.API03 — is idempotent: 200 and cleared cookies with no cookies or malformed ones', async () => {
    for (const cookie of [undefined, 'access-token=not-a-jwt; jti=x; refresh-token=y']) {
      const response = await logout(cookie);

      expect(response.status).toBe(200);
      expect(clearedCookies(response)).toEqual(['access-token', 'jti', 'refresh-token']);
    }
  });

  it('owner-auth.API03 — signs out with an expired access token (expiry ignored)', async () => {
    const jar = await signIn();
    clock.advance(PAST_TOKEN_EXPIRY_MS);

    expect((await logout(authCookies(jar))).status).toBe(200);
    expect(await storedSession()).toEqual({});
  });
});

// Last in the file: Vitest runs a file's tests in order, so every request above has been logged.
describe('logging', () => {
  it('owner-auth.AC15 / IT15 — no log line carries the password, the email or any cookie value seen in this file', () => {
    // Login, refresh and logout above produced at least one access token, jti and refresh token.
    expect(secrets.size).toBeGreaterThan(5);
    const logged = JSON.stringify(logger.entries);

    for (const secret of secrets) expect(logged).not.toContain(secret);
  });
});
