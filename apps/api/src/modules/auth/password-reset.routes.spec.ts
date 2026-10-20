/**
 * `owner-auth.API05`–`API07` end to end: the real container and app over real HTTP, a real
 * `mongod` and a real Redis (`owner-auth.T08`; IT16–IT21, the development half of IT22, IT24;
 * AC15–AC22).
 *
 * The container gets a `RecordingMailSender`, so the code is read back out of the "sent" email
 * without a provider (ADR-0009), and a `ManualClock`, so expiry (IT20) and the resend cooldown
 * (IT21) are reached by moving time. Every non-GET sends `Origin: WEB_ORIGIN`, as the browser
 * does through the web app.
 *
 * Each test gets a fresh app (its own send-limit counters and mail recorder) and a freshly
 * created owner, so a test that changes the password or uses up the limit affects no other.
 *
 * Every code, reference, identifier, password, email and cookie value seen during the run is
 * collected and must not appear in any log line (`owner-auth.AC15`).
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
import { BcryptOtpHasher } from './adapters/bcrypt-otp-hasher.js';
import type { IMailSender } from './auth.interface.js';
import { otpModel } from './otp.model.js';
import { UserRepository } from './user.repository.js';

const JWT_SECRET = 'password-reset-spec-placeholder-secret-0';
const OWNER_EMAIL = 'reset-owner@example.test';
const OLD_PASSWORD = 'the password before reset';
const NEW_PASSWORD = 'the password after reset';
/** The web app's origin for this run: the only one allowed to send a non-GET. */
const WEB_ORIGIN = 'http://127.0.0.1:3100';
const CODE_TTL_MS = 10 * 60 * 1_000;
const REFERENCE_TTL_SEC = 24 * 60 * 60;

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let clock: ManualClock;
let logger: RecordingLogger;
let mail: RecordingMailSender;
let api: ApiApplication;
let ownerId: string;
/** Every secret value the run produced, for the log check at the end (AC15). */
const secrets = new Set<string>([OWNER_EMAIL, OLD_PASSWORD, NEW_PASSWORD]);

/**
 * A fresh container and app over the shared datastores. `mailSender` is the recording sender
 * unless a test passes `null`, which leaves mail to the configured strategy — none here, so
 * the disabled sender (IT22).
 */
function buildApi(mailSender: IMailSender | null = mail): ApiApplication {
  const env = loadEnv({
    NODE_ENV: 'test',
    PORT: '4100',
    MONGODB_URI: mongo.uri,
    REDIS_URL: redis.url,
    JWT_ACCESS_SECRET: JWT_SECRET,
    WEB_ORIGIN,
  });
  return createApp(
    buildContainer({
      env,
      logger,
      mongo: mongo.connection,
      redis: redis.connection,
      clock,
      ...(mailSender ? { mailSender } : {}),
    }),
  );
}

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  logger = new RecordingLogger();
  await otpModel(mongo.connection.getConnection()).init();
});

beforeEach(async () => {
  clock = new ManualClock(new Date());
  mail = new RecordingMailSender();
  api = buildApi();
  // The owner seeder is `owner-auth.T09`; until then the test writes the user directly.
  const owner = await new UserRepository(mongo.connection).create({
    email: OWNER_EMAIL,
    passwordHash: await new Argon2PasswordHasher().hash(OLD_PASSWORD),
    displayName: 'Owner',
    emailVerifiedAt: new Date(),
  });
  ownerId = owner.id;
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

/** API05; remembers the reference for the AC15 check. */
async function forgot(email = OWNER_EMAIL, app = api): Promise<request.Response> {
  const response = await post('/password/forgot', { email }, app);
  rememberReference(response);
  return response;
}

/** API06; remembers the reference for the AC15 check. */
async function resend(reference: string): Promise<request.Response> {
  const response = await post('/password/resend', { reference });
  rememberReference(response);
  return response;
}

function reset(reference: string, otp: string, newPassword = NEW_PASSWORD): request.Test {
  return post('/password/reset', { reference, otp, newPassword });
}

function login(password: string, app = api): request.Test {
  return post('/login', { email: OWNER_EMAIL, password }, app);
}

function rememberReference(response: request.Response): void {
  const { data } = response.body as { data?: { reference?: unknown } };
  if (typeof data?.reference === 'string') secrets.add(data.reference);
}

/** The reference in a 200 answer from API05 or API06. */
function referenceOf(response: request.Response): string {
  expect(response.status).toBe(200);
  return (response.body as { data: { reference: string } }).data.reference;
}

/** The 6-digit code in the most recent email; remembered for the AC15 check. */
function lastCode(): string {
  const match = /\b(\d{6})\b/.exec(mail.last?.text ?? '');
  if (!match?.[1]) throw new Error('no code in the last email');
  secrets.add(match[1]);
  return match[1];
}

/** A 6-digit code that is not `code`. */
function wrongCode(code: string): string {
  return code === '000000' ? '000001' : '000000';
}

/** The owner's `otps` document, or `null`; its identifier is remembered for AC15. */
async function storedOtp() {
  const found = await otpModel(mongo.connection.getConnection())
    .findOne({})
    .lean<{ identifier: string; otpHash: string; attempts: number; sentAt: Date; expiresAt: Date }>()
    .exec();
  if (found) secrets.add(found.identifier);
  return found;
}

function countOtps(): Promise<number> {
  return otpModel(mongo.connection.getConnection()).countDocuments().exec();
}

/** Every one-time-code reference key in the test's Redis database. */
function referenceKeys(): Promise<string[]> {
  return redis.connection.getClient().keys('auth:otp-ref:*');
}

/** The `Set-Cookie` lines of a response, joined into the `Cookie` header a browser sends. */
function cookieHeader(response: request.Response): string {
  const lines = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const pairs = lines.map((line) => line.slice(0, line.indexOf(';')));
  for (const pair of pairs) secrets.add(pair.slice(pair.indexOf('=') + 1));
  return pairs.join('; ');
}

/** Names of the cookies a response cleared (empty value, expired). */
function clearedCookies(response: request.Response): string[] {
  const lines = (response.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  return lines
    .filter((line) => line.includes('Expires=Thu, 01 Jan 1970'))
    .map((line) => line.slice(0, line.indexOf('=')))
    .sort();
}

function expectError(response: request.Response, status: number, code: string): void {
  expect(response.status).toBe(status);
  expect(response.body).toEqual({
    success: false,
    message: expect.any(String) as unknown,
    data: expect.objectContaining({ code }) as unknown,
  });
}

describe('POST /api/v1/auth/password/forgot (owner-auth.API05)', () => {
  it('owner-auth.IT16 / AC16 — for the owner: 200 with a reference, one bcrypt-hashed code expiring in 10 minutes, the reference mapped in Redis and one email', async () => {
    const response = await forgot();

    expect(response.body).toEqual({
      success: true,
      message: 'If the address is registered, a code has been sent',
      data: { reference: expect.any(String) as unknown, expiresInSec: 600 },
    });
    const reference = referenceOf(response);

    expect(mail.sent).toHaveLength(1);
    expect(mail.last?.to).toBe(OWNER_EMAIL);
    const code = lastCode();
    expect(JSON.stringify(response.body)).not.toContain(code);

    expect(await countOtps()).toBe(1);
    const stored = await storedOtp();
    expect(stored?.otpHash).toMatch(/^\$2[aby]\$10\$/);
    await expect(new BcryptOtpHasher().compare(code, stored?.otpHash ?? '')).resolves.toBe(true);
    expect(stored?.attempts).toBe(0);
    expect((stored?.expiresAt.getTime() ?? 0) - (stored?.sentAt.getTime() ?? 0)).toBe(CODE_TTL_MS);

    const client = redis.connection.getClient();
    await expect(client.get(`auth:otp-ref:${reference}`)).resolves.toBe(stored?.identifier);
    expect(await client.ttl(`auth:otp-ref:${reference}`)).toBeGreaterThan(REFERENCE_TTL_SEC - 5);
  });

  it('owner-auth.IT17 / AC17 — for an unknown email: the same status, message and shape; no document, key or email', async () => {
    const owners = await forgot();
    await mongo.reset();
    await redis.reset();
    await new UserRepository(mongo.connection).create({
      email: OWNER_EMAIL,
      passwordHash: await new Argon2PasswordHasher().hash(OLD_PASSWORD),
      displayName: 'Owner',
      emailVerifiedAt: new Date(),
    });
    const sentBefore = mail.sent.length;

    const stranger = await forgot('stranger@example.test');

    expect(stranger.status).toBe(owners.status);
    expect(stranger.body).toEqual({
      ...(owners.body as object),
      data: { reference: expect.any(String) as unknown, expiresInSec: 600 },
    });
    expect(await countOtps()).toBe(0);
    expect(await referenceKeys()).toEqual([]);
    expect(mail.sent).toHaveLength(sentBefore);
  });

  it('owner-auth.IT24 — a second request replaces the code: one document, and the first reference is OTP_INVALID', async () => {
    const first = referenceOf(await forgot());
    const firstCode = lastCode();
    referenceOf(await forgot());

    expect(await countOtps()).toBe(1);
    expectError(await reset(first, firstCode), 400, 'OTP_INVALID');
  });

  it('owner-auth.API05 — the sixth request in an hour from one IP is 429 RATE_LIMITED, and resend shares the count', async () => {
    let reference = '';
    for (let send = 0; send < 5; send += 1) reference = referenceOf(await forgot());
    clock.advance(61_000);

    const sixth = await forgot();
    const resent = await resend(reference);

    for (const response of [sixth, resent]) {
      expectError(response, 429, 'RATE_LIMITED');
      // The hourly window, not the 60-second cooldown.
      expect(Number(response.headers['retry-after'])).toBeGreaterThan(60);
    }
    expect(mail.sent).toHaveLength(5);
  });

  it('owner-auth.API05 — a refused send is 502 UPSTREAM_FAILED naming the mail provider', async () => {
    mail.refuseSends();

    const response = await forgot();

    expectError(response, 502, 'UPSTREAM_FAILED');
    expect(response.body).toMatchObject({ data: { code: 'UPSTREAM_FAILED', provider: 'mail' } });
  });

  it('owner-auth.IT22 / AC22 — with no mail strategy outside production: forgot is 503 for every address and writes nothing; sign-in still works', async () => {
    const unconfigured = buildApi(null);

    for (const email of [OWNER_EMAIL, 'stranger@example.test']) {
      expectError(await forgot(email, unconfigured), 503, 'SERVICE_UNAVAILABLE');
    }
    expect(await countOtps()).toBe(0);
    expect(await referenceKeys()).toEqual([]);
    expect((await login(OLD_PASSWORD, unconfigured)).status).toBe(200);
  });

  it('owner-auth.API05 — a malformed email is 400 VALIDATION_FAILED; no Origin is 403', async () => {
    expectError(await forgot('not-an-email'), 400, 'VALIDATION_FAILED');
    const noOrigin = await request(api.handler)
      .post('/api/v1/auth/password/forgot')
      .send({ email: OWNER_EMAIL });
    expectError(noOrigin, 403, 'ORIGIN_NOT_ALLOWED');
    expect(mail.sent).toHaveLength(0);
  });
});

describe('POST /api/v1/auth/password/reset (owner-auth.API07)', () => {
  it('owner-auth.IT18 / AC18 — the mailed code sets the new password, ends the session everywhere and cannot be used twice', async () => {
    const signedIn = await login(OLD_PASSWORD);
    expect(signedIn.status).toBe(200);
    const oldSession = cookieHeader(signedIn);
    const reference = referenceOf(await forgot());
    const code = lastCode();

    const response = await reset(reference, code);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, message: 'Password updated' });
    expect(clearedCookies(response)).toEqual(['access-token', 'jti', 'refresh-token']);
    expect(await countOtps()).toBe(0);
    expect(await referenceKeys()).toEqual([]);
    expect(await redis.connection.getClient().exists(`auth:session:${ownerId}`)).toBe(0);
    // Checked before the new sign-in, which would otherwise make this SESSION_EXPIRED.
    expectError(
      await request(api.handler).get('/api/v1/auth/me').set('Cookie', oldSession),
      401,
      'UNAUTHENTICATED',
    );

    expectError(await login(OLD_PASSWORD), 401, 'UNAUTHENTICATED');
    expect(cookieHeader(await login(NEW_PASSWORD))).not.toBe('');
    expectError(await reset(reference, code), 400, 'OTP_INVALID');
  });

  it('owner-auth.IT19 / AC19 — five wrong codes are each OTP_INVALID and leave attempts at 5; the right code is then OTP_INVALID too', async () => {
    const reference = referenceOf(await forgot());
    const code = lastCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expectError(await reset(reference, wrongCode(code)), 400, 'OTP_INVALID');
    }
    expect((await storedOtp())?.attempts).toBe(5);

    const right = await reset(reference, code);

    expectError(right, 400, 'OTP_INVALID');
    // One body for every cause (spec → Error Handling).
    expect(right.body).toEqual({
      success: false,
      message: 'The code is invalid',
      data: { code: 'OTP_INVALID' },
    });
    expect((await login(OLD_PASSWORD)).status).toBe(200);
  });

  it('owner-auth.IT20 / AC20 — after 11 minutes the right code is OTP_EXPIRED and the document stays', async () => {
    const reference = referenceOf(await forgot());
    const code = lastCode();
    clock.advance(11 * 60 * 1_000);

    expectError(await reset(reference, code), 400, 'OTP_EXPIRED');
    expect(await countOtps()).toBe(1);
  });

  it('owner-auth.API07 — a reference never issued is OTP_INVALID', async () => {
    expectError(await reset(`$2b$10$${'x'.repeat(53)}`, '000000'), 400, 'OTP_INVALID');
  });

  it('owner-auth.API07 — data variations: bad codes, short passwords and long references are 400 VALIDATION_FAILED; 000000 and a 12-character password pass validation', async () => {
    for (const otp of ['12345', '1234567', 'abcdef']) {
      expectError(await reset('some-reference', otp), 400, 'VALIDATION_FAILED');
    }
    expectError(await reset('some-reference', '123456', 'x'.repeat(11)), 400, 'VALIDATION_FAILED');
    expectError(await reset('r'.repeat(101), '123456'), 400, 'VALIDATION_FAILED');
    expectError(await reset('', '123456'), 400, 'VALIDATION_FAILED');

    // Valid input with a reference never issued gets past validation to OTP_INVALID.
    expectError(await reset('some-reference', '000000', 'x'.repeat(12)), 400, 'OTP_INVALID');
  });
});

describe('POST /api/v1/auth/password/resend (owner-auth.API06)', () => {
  it('owner-auth.IT21 / AC21 — at 30 s it is 429 with Retry-After; at 61 s a new code and reference; the old reference and code are dead', async () => {
    const first = referenceOf(await forgot());
    const firstCode = lastCode();
    clock.advance(30_000);

    const early = await resend(first);

    expectError(early, 429, 'RATE_LIMITED');
    expect(early.headers['retry-after']).toBe('30');
    expect(mail.sent).toHaveLength(1);

    clock.advance(31_000);
    const response = await resend(first);

    expect(response.body).toEqual({
      success: true,
      message: 'A new code has been sent',
      data: { reference: expect.any(String) as unknown, expiresInSec: 600 },
    });
    const second = referenceOf(response);
    expect(second).not.toBe(first);
    expect(mail.sent).toHaveLength(2);
    const secondCode = lastCode();
    expect((await storedOtp())?.attempts).toBe(0);
    await expect(redis.connection.getClient().exists(`auth:otp-ref:${first}`)).resolves.toBe(0);

    expectError(await reset(first, secondCode), 400, 'OTP_INVALID');
    if (firstCode !== secondCode) {
      expectError(await reset(second, firstCode), 400, 'OTP_INVALID');
    }
    expect((await reset(second, secondCode)).status).toBe(200);
  });

  it('owner-auth.API06 — a reference that resolves to nothing is 400 OTP_INVALID', async () => {
    expectError(await resend('never-issued'), 400, 'OTP_INVALID');
    expectError(await post('/password/resend', { reference: '' }), 400, 'VALIDATION_FAILED');
  });
});

// Last in the file: Vitest runs a file's tests in order, so every request above has been logged.
describe('logging', () => {
  it('owner-auth.AC15 / IT15 — no log line carries a code, reference, identifier, password, email or cookie value seen in this file', () => {
    // At least one code, reference and identifier were collected above.
    expect(secrets.size).toBeGreaterThan(10);
    const logged = JSON.stringify(logger.entries);

    for (const secret of secrets) expect(logged).not.toContain(secret);
  });
});
