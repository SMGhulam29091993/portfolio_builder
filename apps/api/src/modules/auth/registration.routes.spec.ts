/**
 * `account-registration.API01`–`API05` end to end: the real container and app over real HTTP,
 * a real `mongod` and a real Redis (`account-registration.T03`; IT01–IT15).
 *
 * The container gets a `RecordingMailSender`, so codes are read back out of the "sent" email
 * (ADR-0009: no test sends real mail), and a `ManualClock` for expiry and the resend cooldown.
 * Every non-GET sends `Origin: WEB_ORIGIN`, as the browser does through the web app. Each test
 * gets a fresh app, so send-limit counters never leak between tests.
 *
 * Every email, password, display name, secret, code, reference and cookie value seen during the
 * run is collected and must not appear in any log line (`account-registration.AC15`).
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import {
  ManualClock,
  MongoTestHarness,
  RecordingLogger,
  RecordingMailSender,
  RedisTestHarness,
} from '../../testing/index.js';
import { Argon2PasswordHasher } from './adapters/argon2-password-hasher.js';
import { otpModel } from './otp.model.js';
import { userModel } from './user.model.js';
import { UserRepository } from './user.repository.js';

const JWT_SECRET = 'registration-spec-placeholder-secret-000';
const OWNER_SECRET = 'registration-spec-owner-secret-0123456789';
const WEB_ORIGIN = 'http://127.0.0.1:3100';
const EMAIL = 'new.member@example.test';
const PASSWORD = 'a registration password';
const DISPLAY_NAME = 'Newly Registered';

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let clock: ManualClock;
let logger: RecordingLogger;
let mail: RecordingMailSender;
let api: ApiApplication;
/** Every secret value the run produced, for the log check at the end (AC15). */
const secrets = new Set<string>([EMAIL, PASSWORD, DISPLAY_NAME, OWNER_SECRET]);

function buildApi(ownerSecret: string | undefined = OWNER_SECRET): ApiApplication {
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '4100',
    MONGODB_URI: mongo.uri,
    REDIS_URL: redis.url,
    JWT_ACCESS_SECRET: JWT_SECRET,
    WEB_ORIGIN,
    OWNER_REGISTRATION_SECRET: ownerSecret,
  });
  return createApp(
    buildContainer({
      env,
      logger,
      mongo: mongo.connection,
      redis: redis.connection,
      clock,
      mailSender: mail,
    }),
  );
}

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  logger = new RecordingLogger();
  // Wait for the unique and partial indexes, so the race and duplicate cases cannot beat them.
  await userModel(mongo.connection.getConnection()).init();
  await otpModel(mongo.connection.getConnection()).init();
});

beforeEach(() => {
  clock = new ManualClock(new Date());
  mail = new RecordingMailSender();
  api = buildApi();
});

afterEach(async () => {
  await mongo.reset();
  await redis.reset();
});

afterAll(async () => {
  await mongo.stop();
  await redis.stop();
});

function post(path: string, body: object, app = api): request.Test {
  return request(app.handler).post(`/api/v1/auth${path}`).set('Origin', WEB_ORIGIN).send(body);
}

async function register(body: object = {}, app = api): Promise<request.Response> {
  const response = await post(
    '/register',
    { email: EMAIL, password: PASSWORD, displayName: DISPLAY_NAME, ...body },
    app,
  );
  remember(response);
  return response;
}

function remember(response: request.Response): void {
  const { data } = response.body as { data?: { reference?: unknown } };
  if (typeof data?.reference === 'string') secrets.add(data.reference);
}

function referenceOf(response: request.Response): string {
  expect(response.status).toBe(200);
  return (response.body as { data: { reference: string } }).data.reference;
}

function lastCode(): string {
  const match = /\b(\d{6})\b/.exec(mail.last?.text ?? '');
  if (!match?.[1]) throw new Error('no code in the last email');
  secrets.add(match[1]);
  return match[1];
}

function wrongCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

function cookieHeader(response: request.Response): string {
  const lines = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const pairs = lines.map((line) => line.slice(0, line.indexOf(';')));
  for (const pair of pairs) secrets.add(pair.slice(pair.indexOf('=') + 1));
  return pairs.join('; ');
}

function expectError(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.body).toMatchObject({ success: false, data: { code } });
}

function stored(email = EMAIL) {
  return new UserRepository(mongo.connection).findByEmail(email);
}

async function createVerified(email: string, role: 'owner' | 'member' = 'member') {
  return new UserRepository(mongo.connection).create({
    email,
    passwordHash: await new Argon2PasswordHasher().hash(PASSWORD),
    displayName: 'Existing',
    role,
    emailVerifiedAt: new Date(),
  });
}

describe('POST /api/v1/auth/register (account-registration.API02)', () => {
  it('account-registration.IT01 / AC1 — creates an unverified member and mails one code', async () => {
    const response = await register();

    expect(response.body).toEqual({
      success: true,
      message: 'Check your email for a verification code',
      data: { reference: expect.any(String) as unknown, expiresInSec: 600 },
    });
    const user = await stored();
    expect(user).toMatchObject({ role: 'member', displayName: DISPLAY_NAME });
    expect(user?.emailVerifiedAt).toBeUndefined();
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(mail.sent.map((message) => message.to)).toEqual([EMAIL]);
    expect(JSON.stringify(response.body)).not.toContain(lastCode());
  });

  it('account-registration.IT02 / AC2 — a verified address: same body, nothing changed or sent', async () => {
    const existing = await createVerified(EMAIL);

    const response = await register();

    expect(response.status).toBe(200);
    expect((response.body as { message: string }).message).toBe(
      'Check your email for a verification code',
    );
    await expect(stored()).resolves.toEqual(existing);
    expect(mail.sent).toHaveLength(0);
    await expect(otpModel(mongo.connection.getConnection()).countDocuments()).resolves.toBe(0);
  });

  it('account-registration.IT03 / AC3 — registering again while unverified replaces it', async () => {
    const first = referenceOf(await register());
    const firstCode = lastCode();

    await register({ password: 'a second password value', displayName: 'Second Name' });

    expect((await stored())?.displayName).toBe('Second Name');
    expectError(await post('/register/verify', { reference: first, otp: firstCode }), 400, 'OTP_INVALID');
  });

  it('account-registration.IT04 / AC4 — the right owner secret claims the owner; the claim closes', async () => {
    const before = await request(api.handler).get('/api/v1/auth/registration/options');
    expect(before.body).toEqual({
      success: true,
      message: 'Registration options',
      data: { ownerClaimOpen: true, googleSignIn: false },
    });

    expect((await register({ ownerSecret: OWNER_SECRET })).status).toBe(200);

    expect((await stored())?.role).toBe('owner');
    const after = await request(api.handler).get('/api/v1/auth/registration/options');
    expect((after.body as { data: unknown }).data).toEqual({ ownerClaimOpen: false, googleSignIn: false });
  });

  it('account-registration.IT05 / AC5 — a refused claim is 403 and writes and sends nothing', async () => {
    expectError(await register({ ownerSecret: 'not the secret' }), 403, 'OWNER_CLAIM_REFUSED');

    await createVerified('owner@example.test', 'owner');
    expectError(await register({ ownerSecret: OWNER_SECRET }), 403, 'OWNER_CLAIM_REFUSED');

    const closed = buildApi(undefined);
    expectError(await register({ ownerSecret: OWNER_SECRET }, closed), 403, 'OWNER_CLAIM_REFUSED');
    expect((await request(closed.handler).get('/api/v1/auth/registration/options').expect(200)).body).toMatchObject({
      data: { ownerClaimOpen: false },
    });

    await expect(stored()).resolves.toBeNull();
    expect(mail.sent).toHaveLength(0);
  });

  it('an empty ownerSecret registers a member even while the claim is closed', async () => {
    await createVerified('owner@example.test', 'owner');

    expect((await register({ ownerSecret: '' })).status).toBe(200);
    expect((await stored())?.role).toBe('member');
  });

  it('account-registration.IT06 / AC6 — two racing claims: one owner, one 409', async () => {
    const [a, b] = await Promise.all([
      register({ email: 'first@example.test', ownerSecret: OWNER_SECRET }),
      register({ email: 'second@example.test', ownerSecret: OWNER_SECRET }),
    ]);

    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expectError(loser, 409, 'OWNER_EXISTS');
    const owners = await userModel(mongo.connection.getConnection()).countDocuments({ role: 'owner' });
    expect(owners).toBe(1);
    expect(mail.sent).toHaveLength(1);
  });

  it('cleans the display name and validates the body', async () => {
    await register({ displayName: '  <b>Ann</b>  ' });
    expect((await stored())?.displayName).toBe('Ann');

    expectError(await register({ email: 'x@example.test', password: 'short' }), 400, 'VALIDATION_FAILED');
    expectError(await register({ email: 'y@example.test', displayName: '<p></p>' }), 400, 'VALIDATION_FAILED');
  });

  it('answers 403 ORIGIN_NOT_ALLOWED without the web origin', async () => {
    const response = await request(api.handler)
      .post('/api/v1/auth/register')
      .send({ email: EMAIL, password: PASSWORD, displayName: DISPLAY_NAME });

    expectError(response, 403, 'ORIGIN_NOT_ALLOWED');
  });
});

describe('POST /api/v1/auth/register/verify (account-registration.API03)', () => {
  it('account-registration.IT07 / AC7 — verifies, signs in and returns the role', async () => {
    const reference = referenceOf(await register({ ownerSecret: OWNER_SECRET }));

    const response = await post('/register/verify', { reference, otp: lastCode() });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      message: 'Email verified',
      data: { user: { email: EMAIL, displayName: DISPLAY_NAME, role: 'owner' } },
    });
    const cookies = cookieHeader(response);
    for (const name of ['access-token', 'refresh-token', 'jti']) {
      expect(cookies).toMatch(new RegExp(`(^|; )${name}=[^;]+`));
    }
    const user = await stored();
    expect(user?.emailVerifiedAt).toBeInstanceOf(Date);
    await expect(redis.connection.getClient().exists(`auth:session:${user?.id ?? ''}`)).resolves.toBe(1);

    const me = await request(api.handler).get('/api/v1/auth/me').set('Cookie', cookies);
    expect(me.status).toBe(200);
    await expect(redis.connection.getClient().keys('auth:otp-ref:*')).resolves.toEqual([]);
  });

  it('account-registration.IT08 / AC8 — five wrong codes exhaust it; expiry costs no attempt', async () => {
    const reference = referenceOf(await register());
    const code = lastCode();

    clock.advance(10 * 60 * 1_000);
    expectError(await post('/register/verify', { reference, otp: code }), 400, 'OTP_EXPIRED');
    const doc = await otpModel(mongo.connection.getConnection()).findOne({}).lean().exec();
    expect(doc?.attempts).toBe(0);

    const fresh = referenceOf(await register());
    const freshCode = lastCode();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expectError(await post('/register/verify', { reference: fresh, otp: wrongCode(freshCode) }), 400, 'OTP_INVALID');
    }
    expectError(await post('/register/verify', { reference: fresh, otp: freshCode }), 400, 'OTP_INVALID');
  });
});

describe('sign-in of an unverified account (account-registration.AC9)', () => {
  it('account-registration.IT09 — 403 with the right password, 401 with a wrong one', async () => {
    await register();

    const right = await post('/login', { email: EMAIL, password: PASSWORD });
    expectError(right, 403, 'EMAIL_NOT_VERIFIED');
    expect(right.headers['set-cookie']).toBeUndefined();
    expectError(await post('/login', { email: EMAIL, password: 'the wrong password' }), 401, 'UNAUTHENTICATED');
  });
});

describe('verification request and resend (account-registration.API04, API05)', () => {
  it('account-registration.IT10 / AC10 — real for unverified, decoy for unknown and verified', async () => {
    await register();
    await createVerified('done@example.test');
    mail.sent.length = 0;

    const responses = await Promise.all(
      [EMAIL, 'done@example.test', 'nobody@example.test'].map((email) =>
        post('/verification/request', { email }),
      ),
    );

    for (const response of responses) {
      remember(response);
      expect(response.body).toMatchObject({
        message: 'If the address needs verifying, a code has been sent',
        data: { expiresInSec: 600 },
      });
    }
    expect(mail.sent.map((message) => message.to)).toEqual([EMAIL]);
  });

  it('account-registration.IT11 / AC11 — 429 inside the cooldown, then a rotation', async () => {
    const first = referenceOf(await register());

    const early = await post('/verification/resend', { reference: first });
    expectError(early, 429, 'RATE_LIMITED');
    expect(early.headers['retry-after']).toBe('60');

    clock.advance(60_000);
    const next = await post('/verification/resend', { reference: first });
    remember(next);
    const second = referenceOf(next);
    expect(second).not.toBe(first);
    expectError(await post('/verification/resend', { reference: first }), 400, 'OTP_INVALID');
    expect((await post('/register/verify', { reference: second, otp: lastCode() })).status).toBe(200);
  });

  it('account-registration.IT12 / AC12 — references never cross purposes', async () => {
    await createVerified('reset@example.test');
    const resetResponse = await post('/password/forgot', { email: 'reset@example.test' });
    remember(resetResponse);
    const resetReference = referenceOf(resetResponse);
    const resetCode = lastCode();

    expectError(await post('/register/verify', { reference: resetReference, otp: resetCode }), 400, 'OTP_INVALID');

    const verificationReference = referenceOf(await register());
    const verificationCode = lastCode();
    expectError(
      await post('/password/reset', {
        reference: verificationReference,
        otp: verificationCode,
        newPassword: 'another long password',
      }),
      400,
      'OTP_INVALID',
    );
  });

  it('account-registration.IT13 / AC13 — a password reset verifies the email', async () => {
    await register();
    const forgot = await post('/password/forgot', { email: EMAIL });
    remember(forgot);

    const reset = await post('/password/reset', {
      reference: referenceOf(forgot),
      otp: lastCode(),
      newPassword: 'the reset password value',
    });

    expect(reset.status).toBe(200);
    expect((await stored())?.emailVerifiedAt).toBeInstanceOf(Date);
    expect((await post('/login', { email: EMAIL, password: 'the reset password value' })).status).toBe(200);
  });

  it('account-registration.IT14 / AC14 — one send limit across every code-sending route', async () => {
    await register();
    await post('/verification/request', { email: EMAIL });
    await post('/password/forgot', { email: EMAIL });
    await post('/verification/request', { email: 'nobody@example.test' });
    await register({ email: 'other@example.test' });

    expectError(await post('/verification/request', { email: EMAIL }), 429, 'RATE_LIMITED');
    expectError(await register({ email: 'third@example.test' }), 429, 'RATE_LIMITED');
  });
});

// Last in the file: Vitest runs a file's tests in order, so every request above has been logged.
describe('logging', () => {
  it('account-registration.IT15 / AC15 — no log line carries a secret value seen in this file', () => {
    expect(secrets.size).toBeGreaterThan(10);
    const logged = JSON.stringify(logger.entries);

    for (const secret of secrets) expect(logged).not.toContain(secret);
  });
});
