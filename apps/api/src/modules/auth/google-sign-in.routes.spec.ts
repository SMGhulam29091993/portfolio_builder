/**
 * `google-sign-in.API01`–`API02` end to end: the real container and app, a real `mongod`, a
 * real Redis and the real `OidcProvider` talking to `LocalOidcIssuer` — no request reaches
 * Google (`google-sign-in.T03`; IT01–IT11).
 *
 * A test plays the browser: it follows API01's redirect far enough to read the parameters,
 * asks the local issuer for a code bound to that nonce and challenge (what Google would do
 * after the user consented), then calls API02 with the `google-state` cookie API01 set.
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import {
  LOCAL_CLIENT_ID,
  LOCAL_CLIENT_SECRET,
  LocalOidcIssuer,
  MongoTestHarness,
  RecordingLogger,
  RecordingMailSender,
  RedisTestHarness,
  type IssuedCode,
} from '../../testing/index.js';
import { Argon2PasswordHasher } from './adapters/argon2-password-hasher.js';
import { userModel } from './user.model.js';
import { UserRepository } from './user.repository.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';
const REDIRECT_URL = `${WEB_ORIGIN}/api/v1/auth/google/callback`;
const EMAIL = 'google.person@example.test';

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let issuer: LocalOidcIssuer;
let logger: RecordingLogger;
let api: ApiApplication;
const secrets = new Set<string>([EMAIL, LOCAL_CLIENT_SECRET]);

function buildApi(google = true): ApiApplication {
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '4100',
    MONGODB_URI: mongo.uri,
    REDIS_URL: redis.url,
    JWT_ACCESS_SECRET: 'google-spec-placeholder-secret-0000000000',
    WEB_ORIGIN,
    ...(google
      ? {
          GOOGLE_CLIENT_ID: LOCAL_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: LOCAL_CLIENT_SECRET,
          GOOGLE_REDIRECT_URL: REDIRECT_URL,
          GOOGLE_ISSUER: issuer.issuer,
        }
      : {}),
  });
  return createApp(
    buildContainer({
      env,
      logger,
      mongo: mongo.connection,
      redis: redis.connection,
      mailSender: new RecordingMailSender(),
    }),
  );
}

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  issuer = await LocalOidcIssuer.start(REDIRECT_URL);
  logger = new RecordingLogger();
  await userModel(mongo.connection.getConnection()).init();
});

beforeEach(() => {
  api = buildApi();
});

afterEach(async () => {
  await mongo.reset();
  await redis.reset();
});

afterAll(async () => {
  await issuer.stop();
  await mongo.stop();
  await redis.stop();
});

interface Started {
  readonly location: URL;
  readonly stateCookie: string;
  readonly state: string;
}

/** API01, returning the redirect and the `google-state` cookie a browser would keep. */
async function start(app = api): Promise<Started> {
  const response = await request(app.handler).get('/api/v1/auth/google/start');
  expect(response.status).toBe(302);
  const location = new URL(String(response.headers.location));
  const lines = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const line = lines.find((cookie) => cookie.startsWith('google-state=')) ?? '';
  const stateCookie = line.slice(0, line.indexOf(';'));
  const state = location.searchParams.get('state') ?? '';
  secrets.add(state);
  return { location, stateCookie, state };
}

/** What Google does after consent: a code bound to this flow's nonce and challenge. */
function consent(started: Started, claims: Partial<IssuedCode> = {}): string {
  const code = issuer.issueCode({
    sub: 'google-sub-1',
    email: EMAIL,
    name: 'Google Person',
    nonce: started.location.searchParams.get('nonce') ?? '',
    codeChallenge: started.location.searchParams.get('code_challenge') ?? '',
    ...claims,
  });
  secrets.add(code);
  return code;
}

function callback(query: Record<string, string>, cookie: string, app = api): request.Test {
  return request(app.handler)
    .get('/api/v1/auth/google/callback')
    .query(query)
    .set('Cookie', cookie);
}

function errorOf(response: request.Response): string | null {
  expect(response.status).toBe(302);
  const location = new URL(String(response.headers.location));
  return location.pathname === '/cms/login' ? location.searchParams.get('error') : null;
}

function sessionCookies(response: request.Response): string {
  const lines = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return lines
    .map((line) => line.slice(0, line.indexOf(';')))
    .filter((pair) => !pair.startsWith('google-state=') && !pair.endsWith('='))
    .join('; ');
}

describe('GET /api/v1/auth/google/start (google-sign-in.API01)', () => {
  it('google-sign-in.IT01 / AC1 — redirects with every parameter; cookie and Redis hold the state', async () => {
    const started = await start();
    const params = started.location.searchParams;

    expect(`${started.location.origin}${started.location.pathname}`).toBe(`${issuer.issuer}/authorize`);
    expect(params.get('client_id')).toBe(LOCAL_CLIENT_ID);
    expect(params.get('redirect_uri')).toBe(REDIRECT_URL);
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(started.stateCookie).toBe(`google-state=${started.state}`);
    const key = `auth:google-state:${started.state}`;
    expect(await redis.connection.getClient().ttl(key)).toBeGreaterThan(595);
  });
});

describe('GET /api/v1/auth/google/callback (google-sign-in.API02)', () => {
  it('google-sign-in.IT02 / AC2, AC12 — a new verified email becomes a member and is signed in', async () => {
    const started = await start();

    const response = await callback({ code: consent(started), state: started.state }, started.stateCookie);

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe(`${WEB_ORIGIN}/cms`);
    const user = await new UserRepository(mongo.connection).findByEmail(EMAIL);
    expect(user).toMatchObject({ role: 'member', googleSub: 'google-sub-1', displayName: 'Google Person' });
    expect(user?.passwordHash).toBeUndefined();
    const me = await request(api.handler).get('/api/v1/auth/me').set('Cookie', sessionCookies(response));
    expect(me.status).toBe(200);
    expect((me.body as { data: { user: { email: string } } }).data.user.email).toBe(EMAIL);
  });

  it('google-sign-in.IT03 / AC3 — links an existing password account', async () => {
    const existing = await new UserRepository(mongo.connection).create({
      email: EMAIL,
      passwordHash: await new Argon2PasswordHasher().hash('a password for linking'),
      displayName: 'Existing',
    });
    const started = await start();

    const response = await callback({ code: consent(started), state: started.state }, started.stateCookie);

    expect(errorOf(response)).toBeNull();
    await expect(new UserRepository(mongo.connection).findById(existing.id)).resolves.toMatchObject({
      googleSub: 'google-sub-1',
      role: 'member',
      emailVerifiedAt: expect.any(Date) as Date,
    });
  });

  it('google-sign-in.IT04 / AC4 — the linked subject wins over a changed email', async () => {
    const first = await start();
    await callback({ code: consent(first), state: first.state }, first.stateCookie);
    const second = await start();

    const response = await callback(
      { code: consent(second, { email: 'changed@example.test' }), state: second.state },
      second.stateCookie,
    );

    expect(errorOf(response)).toBeNull();
    await expect(userModel(mongo.connection.getConnection()).countDocuments()).resolves.toBe(1);
  });

  it('google-sign-in.IT05 / AC5 — mismatched, missing or replayed state is google_state', async () => {
    const started = await start();
    const code = consent(started);

    expect(errorOf(await callback({ code, state: started.state }, 'google-state=other'))).toBe('google_state');
    expect(errorOf(await callback({ code, state: started.state }, ''))).toBe('google_state');

    const fresh = await start();
    const freshCode = consent(fresh);
    expect(errorOf(await callback({ code: freshCode, state: fresh.state }, fresh.stateCookie))).toBeNull();
    expect(errorOf(await callback({ code: freshCode, state: fresh.state }, fresh.stateCookie))).toBe('google_state');
  });

  it('google-sign-in.IT06 / AC6 — a token with the wrong nonce is google_failed', async () => {
    const started = await start();

    const response = await callback(
      { code: consent(started, { nonce: 'not-this-flow' }), state: started.state },
      started.stateCookie,
    );

    expect(errorOf(response)).toBe('google_failed');
    await expect(userModel(mongo.connection.getConnection()).countDocuments()).resolves.toBe(0);
  });

  it('google-sign-in.IT07 / AC7 — an unverified email is google_unverified', async () => {
    const started = await start();

    const response = await callback(
      { code: consent(started, { emailVerified: false }), state: started.state },
      started.stateCookie,
    );

    expect(errorOf(response)).toBe('google_unverified');
    await expect(userModel(mongo.connection.getConnection()).countDocuments()).resolves.toBe(0);
  });

  it('google-sign-in.IT08 / AC8 — another subject on a linked email is google_conflict', async () => {
    await new UserRepository(mongo.connection).create({
      email: EMAIL,
      displayName: 'Linked',
      googleSub: 'another-subject',
      emailVerifiedAt: new Date(),
    });
    const started = await start();

    const response = await callback({ code: consent(started), state: started.state }, started.stateCookie);

    expect(errorOf(response)).toBe('google_conflict');
  });

  it('a cancelled consent is google_cancelled and clears the state cookie', async () => {
    const started = await start();

    const response = await callback({ error: 'access_denied', state: started.state }, started.stateCookie);

    expect(errorOf(response)).toBe('google_cancelled');
    const lines = (response.headers['set-cookie'] as unknown as string[]).join('\n');
    expect(lines).toMatch(/google-state=;/);
  });
});

describe('Google not configured (google-sign-in.AC9)', () => {
  it('google-sign-in.IT09 — both routes redirect with google_unavailable; options say false', async () => {
    const off = buildApi(false);

    const startResponse = await request(off.handler).get('/api/v1/auth/google/start');
    expect(errorOf(startResponse)).toBe('google_unavailable');
    expect(errorOf(await callback({ code: 'c', state: 's' }, 'google-state=s', off))).toBe('google_unavailable');
    const options = await request(off.handler).get('/api/v1/auth/registration/options');
    expect((options.body as { data: unknown }).data).toMatchObject({ googleSignIn: false });
    const onOptions = await request(api.handler).get('/api/v1/auth/registration/options');
    expect((onOptions.body as { data: unknown }).data).toMatchObject({ googleSignIn: true });
  });
});

describe('Google-only account and password sign-in (google-sign-in.AC10)', () => {
  it('google-sign-in.IT10 — any password answers the usual 401', async () => {
    const started = await start();
    await callback({ code: consent(started), state: started.state }, started.stateCookie);

    const response = await request(api.handler)
      .post('/api/v1/auth/login')
      .set('Origin', WEB_ORIGIN)
      .send({ email: EMAIL, password: 'any password at all' });

    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ data: { code: 'UNAUTHENTICATED' } });
  });
});

describe('logging', () => {
  it('google-sign-in.IT11 / AC11 — no log line carries a code, state, email or secret', () => {
    expect(secrets.size).toBeGreaterThan(5);
    const logged = JSON.stringify(logger.entries);

    for (const secret of secrets) expect(logged).not.toContain(secret);
  });
});
