/**
 * `site-identity.API01`–`API02` end to end with real assets (`site-identity.T04`, `T05`;
 * IT02–IT06, IT08, AC8, AC11).
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import {
  FIXTURE_HEADERS,
  fixtureFile,
  MongoTestHarness,
  RecordingLogger,
  RecordingMailSender,
  RedisTestHarness,
} from '../../testing/index.js';
import { identityModel } from './identity.model.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let api: ApiApplication;
let mail: RecordingMailSender;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  await identityModel(mongo.connection.getConnection()).init();
});
beforeEach(() => {
  mail = new RecordingMailSender();
  api = createApp(
    buildContainer({
      env: loadEnv({
        NODE_ENV: 'test',
        PORT: '4100',
        MONGODB_URI: mongo.uri,
        REDIS_URL: redis.url,
        JWT_ACCESS_SECRET: 'identity-routes-placeholder-secret-00000',
        WEB_ORIGIN,
      }),
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

async function signIn(email: string, displayName: string): Promise<string> {
  const registered = await request(api.handler)
    .post('/api/v1/auth/register')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password: 'an identity test password', displayName });
  const code = /\b(\d{6})\b/.exec(mail.last?.text ?? '')?.[1] ?? '';
  const verified = await request(api.handler)
    .post('/api/v1/auth/register/verify')
    .set('Origin', WEB_ORIGIN)
    .send({ reference: (registered.body as { data: { reference: string } }).data.reference, otp: code });
  return (verified.headers['set-cookie'] as unknown as string[]).map((line) => line.slice(0, line.indexOf(';'))).join('; ');
}

interface IdentityBody {
  data: { identity: { revision: number; data: Record<string, unknown> & { resume: { assetId: string | null } } } };
}

const read = async (cookie: string) =>
  ((await request(api.handler).get('/api/v1/cms/identity').set('Cookie', cookie)).body as IdentityBody).data.identity;
const save = (cookie: string, body: object) =>
  request(api.handler).put('/api/v1/cms/identity').set('Cookie', cookie).set('Origin', WEB_ORIGIN).send(body);
const uploadAsset = async (cookie: string, kind: string, bytes: Buffer) =>
  (
    (await request(api.handler)
      .post('/api/v1/cms/assets')
      .set('Cookie', cookie)
      .set('Origin', WEB_ORIGIN)
      .field('kind', kind)
      .attach('file', bytes, { filename: 'f', contentType: 'application/octet-stream' })).body as { data: { asset: { id: string } } }
  ).data.asset.id;

describe('identity routes', () => {
  it('site-identity.AC11, IT02 — the template at revision 0; create; update; stale is 409', async () => {
    const cookie = await signIn('ann@example.test', 'Ann Lee');

    const draft = await read(cookie);
    expect(draft).toMatchObject({ revision: 0, data: { fullName: 'Ann Lee', email: 'ann@example.test', monogram: 'AL' } });
    expect((await save(cookie, { expectedRevision: 0, data: draft.data })).body).toMatchObject({ data: { identity: { revision: 1 } } });
    expect((await save(cookie, { expectedRevision: 1, data: { ...draft.data, roleTitle: 'Engineer' } })).status).toBe(200);
    const stale = await save(cookie, { expectedRevision: 1, data: draft.data });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ data: { code: 'REVISION_CONFLICT', currentRevision: 2 } });
  });

  it('site-identity.IT03, IT06 — one 400 for several bad fields; phone is never stored', async () => {
    const cookie = await signIn('bo@example.test', 'Bo');
    const { data } = await read(cookie);

    const bad = await save(cookie, { expectedRevision: 0, data: { ...data, email: 'x', monogram: 'gf', socials: [{ platform: 'x', url: 'http://x.test' }] } });
    expect(bad.status).toBe(400);
    expect((bad.body as { data: { errors: unknown[] } }).data.errors).toHaveLength(3);

    expect((await save(cookie, { expectedRevision: 0, data: { ...data, phone: '+91 0' } })).status).toBe(200);
    const stored = await identityModel(mongo.connection.getConnection()).findOne({}).lean().exec();
    expect(stored?.data).not.toHaveProperty('phone');
  });

  it('site-identity.IT04, IT05, AC8 — résumé must be a résumé; a referenced asset cannot be deleted', async () => {
    const cookie = await signIn('cy@example.test', 'Cy');
    const { data } = await read(cookie);
    const image = await uploadAsset(cookie, 'image', fixtureFile(FIXTURE_HEADERS.png));
    const pdf = await uploadAsset(cookie, 'resume', fixtureFile(FIXTURE_HEADERS.pdf));

    const wrong = await save(cookie, { expectedRevision: 0, data: { ...data, resume: { assetId: image, label: 'CV' } } });
    expect(wrong.status).toBe(400);
    expect(wrong.body).toMatchObject({ data: { errors: [{ path: 'resume.assetId' }] } });
    expect((await save(cookie, { expectedRevision: 0, data: { ...data, resume: { assetId: pdf, label: 'CV' } } })).status).toBe(200);

    const blocked = await request(api.handler).delete(`/api/v1/cms/assets/${pdf}`).set('Cookie', cookie).set('Origin', WEB_ORIGIN);
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ data: { usedBy: ['draft identity'] } });
  });

  it('tenant isolation and site-identity.IT08 — no cross-user reads or writes; 401 without a session', async () => {
    const a = await signIn('a@example.test', 'Alpha');
    const b = await signIn('b@example.test', 'Beta');
    const aData = (await read(a)).data;
    await save(a, { expectedRevision: 0, data: { ...aData, roleTitle: 'Alpha only' } });
    const bImage = await uploadAsset(b, 'resume', fixtureFile(FIXTURE_HEADERS.pdf));

    expect((await read(b)).data.fullName).toBe('Beta');
    expect((await read(b)).revision).toBe(0);
    // A's identity cannot point at B's asset.
    expect((await save(a, { expectedRevision: 1, data: { ...aData, resume: { assetId: bImage, label: 'CV' } } })).status).toBe(400);
    expect((await request(api.handler).get('/api/v1/cms/identity')).status).toBe(401);
    expect((await request(api.handler).put('/api/v1/cms/identity').set('Origin', WEB_ORIGIN).send({})).status).toBe(401);
  });
});
