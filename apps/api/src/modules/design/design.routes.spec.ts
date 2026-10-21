/**
 * `design-theme.API01`–`API03` end to end (`design-theme.T04`; IT01–IT06) and CT01: for a table
 * of designs, `IDesignValidator`'s verdict equals the HTTP outcome of API02 (AC11).
 */
import { DEFAULT_DESIGN, type DesignSpec } from '@portfolio/design-tokens';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import { MongoTestHarness, RecordingLogger, RecordingMailSender, RedisTestHarness } from '../../testing/index.js';
import { designModel } from './design.model.js';
import { DesignValidator } from './design.validator.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';
let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let api: ApiApplication;
let mail: RecordingMailSender;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  await designModel(mongo.connection.getConnection()).init();
});
beforeEach(() => {
  mail = new RecordingMailSender();
  api = createApp(
    buildContainer({
      env: loadEnv({ NODE_ENV: 'test', PORT: '4100', MONGODB_URI: mongo.uri, REDIS_URL: redis.url, JWT_ACCESS_SECRET: 'design-routes-placeholder-secret-0000000', WEB_ORIGIN }),
      logger: new RecordingLogger(),
      mongo: mongo.connection,
      redis: redis.connection,
      mailSender: mail,
    }),
  );
});
afterEach(async () => {
  await mongo.reset();
  await redis.reset();
});
afterAll(async () => {
  await mongo.stop();
  await redis.stop();
});

async function signIn(email: string): Promise<string> {
  const registered = await request(api.handler).post('/api/v1/auth/register').set('Origin', WEB_ORIGIN).send({ email, password: 'a design test password', displayName: 'Designer' });
  const code = /\b(\d{6})\b/.exec(mail.last?.text ?? '')?.[1] ?? '';
  const verified = await request(api.handler)
    .post('/api/v1/auth/register/verify')
    .set('Origin', WEB_ORIGIN)
    .send({ reference: (registered.body as { data: { reference: string } }).data.reference, otp: code });
  return (verified.headers['set-cookie'] as unknown as string[]).map((line) => line.slice(0, line.indexOf(';'))).join('; ');
}

const clone = (): DesignSpec => structuredClone(DEFAULT_DESIGN);
const put = (cookie: string, body: object) => request(api.handler).put('/api/v1/cms/design').set('Cookie', cookie).set('Origin', WEB_ORIGIN).send(body);

describe('design routes', () => {
  it('design-theme.IT01 / AC1 — the default design and the catalogue', async () => {
    const cookie = await signIn('d1@example.test');
    const response = await request(api.handler).get('/api/v1/cms/design').set('Cookie', cookie);

    expect(response.body).toMatchObject({ data: { design: { ...DEFAULT_DESIGN, revision: 0 } } });
    const catalogue = (response.body as { data: { catalogue: { variants: Record<string, unknown[]>; fonts: unknown[] } } }).data.catalogue;
    expect(Object.keys(catalogue.variants)).toHaveLength(6);
    expect(catalogue.fonts).toHaveLength(9);
  });

  it('design-theme.IT02, IT05 / AC2, AC5, AC6 — save, stale save, reset', async () => {
    const cookie = await signIn('d2@example.test');
    const edited = clone();
    edited.theme.colors.accent = '#AEF03A';

    const saved = await put(cookie, { expectedRevision: 0, ...edited });
    expect(saved.body).toMatchObject({ data: { design: { revision: 1, theme: { colors: { accent: '#aef03a' } } } } });
    expect((await put(cookie, { expectedRevision: 0, ...edited })).status).toBe(409);
    const reset = await request(api.handler).post('/api/v1/cms/design/reset').set('Cookie', cookie).set('Origin', WEB_ORIGIN).send({ expectedRevision: 1 });
    expect(reset.body).toMatchObject({ data: { design: { ...DEFAULT_DESIGN, revision: 2 } } });
  });

  it('design-theme.IT03, IT04 / AC3, AC4 — one 400 with every path; the contrast message has the ratio', async () => {
    const cookie = await signIn('d3@example.test');
    const bad = clone();
    bad.theme.fonts.sans = 'jetbrains-mono';
    bad.layout.hero = 'bento';
    bad.theme.colors.text = bad.theme.colors.background;

    const response = await put(cookie, { expectedRevision: 0, ...bad });

    expect(response.status).toBe(400);
    const errors = (response.body as { data: { errors: { path: string; message: string }[] } }).data.errors;
    expect(errors.map((e) => e.path)).toEqual(expect.arrayContaining(['theme.fonts.sans', 'layout.hero', 'theme.colors.text']));
    expect(errors.find((e) => e.path === 'theme.colors.text')?.message).toMatch(/1\.00:1; at least 4\.5:1/);
    await expect(designModel(mongo.connection.getConnection()).countDocuments()).resolves.toBe(0);
  });

  it('design-theme.IT06 — every route without a session is 401', async () => {
    expect((await request(api.handler).get('/api/v1/cms/design')).status).toBe(401);
    expect((await request(api.handler).put('/api/v1/cms/design').set('Origin', WEB_ORIGIN).send({})).status).toBe(401);
    expect((await request(api.handler).post('/api/v1/cms/design/reset').set('Origin', WEB_ORIGIN).send({})).status).toBe(401);
  });

  it('design-theme.CT01 / AC11 — the validator verdict equals the HTTP outcome', async () => {
    const cookie = await signIn('d4@example.test');
    const variations: ((design: DesignSpec) => void)[] = [
      () => undefined,
      (d) => { d.theme.colors.accent = '#zzzzzz'; },
      (d) => { d.theme.colors.accent = '#ABCDEF'; },
      (d) => { d.theme.colors.textMuted = '#3f3f46'; },
      (d) => { d.theme.colors.onAccent = '#ffffff'; },
      (d) => { d.theme.colors.accent = '#18181b'; },
      (d) => { d.theme.fonts.mono = 'inter'; },
      (d) => { d.theme.fonts.display = 'unknown-font'; },
      (d) => { d.theme.radius = 'huge' as never; },
      (d) => { d.theme.effects.motion = 'wild' as never; },
      (d) => { d.layout.contact = 'minimal'; },
      (d) => { d.layout.stack = 'timeline'; },
      (d) => { d.layout.experience = 'cards'; d.theme.radius = 'none'; },
    ];
    const validator = new DesignValidator();
    for (const vary of variations) {
      const design = clone();
      vary(design);
      let valid = true;
      try {
        validator.validate(design);
      } catch {
        valid = false;
      }
      const response = await put(cookie, { expectedRevision: 0, ...design });
      expect(response.status === 200, JSON.stringify(design.layout)).toBe(valid);
      if (response.status === 200) await designModel(mongo.connection.getConnection()).deleteMany({});
    }
  });
});
