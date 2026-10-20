/**
 * `media-assets.API01`–`API04` end to end: real container, `mongod` with GridFS, Redis and
 * sign-in through registration (`media-assets.T05`; IT01–IT11, AC13).
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
import type { IAssetReferenceProvider } from './assets.interface.js';
import { assetModel } from './assets.model.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';
const PASSWORD = 'an asset test password';

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let api: ApiApplication;
let mail: RecordingMailSender;
const referenced = new Set<string>();
const testProvider: IAssetReferenceProvider = {
  label: 'test reference',
  referencesAsset: (assetId) => Promise.resolve(referenced.has(assetId)),
};

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  await assetModel(mongo.connection.getConnection()).init();
});

beforeEach(() => {
  referenced.clear();
  mail = new RecordingMailSender();
  api = createApp(
    buildContainer({
      env: loadEnv({
        NODE_ENV: 'test',
        PORT: '4100',
        MONGODB_URI: mongo.uri,
        REDIS_URL: redis.url,
        JWT_ACCESS_SECRET: 'asset-routes-placeholder-secret-000000000',
        WEB_ORIGIN,
      }),
      logger: new RecordingLogger(),
      mongo: mongo.connection,
      redis: redis.connection,
      mailSender: mail,
      extraAssetReferenceProviders: [testProvider],
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

/** Registers and verifies through the API; returns the session `Cookie` header. */
async function signIn(email: string): Promise<string> {
  const registered = await request(api.handler)
    .post('/api/v1/auth/register')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password: PASSWORD, displayName: email.split('@')[0] });
  const code = /\b(\d{6})\b/.exec(mail.last?.text ?? '')?.[1] ?? '';
  const verified = await request(api.handler)
    .post('/api/v1/auth/register/verify')
    .set('Origin', WEB_ORIGIN)
    .send({ reference: (registered.body as { data: { reference: string } }).data.reference, otp: code });
  expect(verified.status).toBe(200);
  return (verified.headers['set-cookie'] as unknown as string[]).map((line) => line.slice(0, line.indexOf(';'))).join('; ');
}

function upload(cookie: string, kind: string, bytes: Buffer, filename = 'cv.pdf', contentType = 'application/pdf'): request.Test {
  return request(api.handler)
    .post('/api/v1/cms/assets')
    .set('Cookie', cookie)
    .set('Origin', WEB_ORIGIN)
    .field('kind', kind)
    .attach('file', bytes, { filename, contentType });
}

interface AssetBody {
  data: { asset: { id: string; sha256: string; inUse: boolean; filename: string } };
}

async function countFiles(): Promise<number> {
  const db = mongo.connection.getConnection().db;
  return db ? db.collection('asset_files.files').countDocuments() : 0;
}

describe('upload and content (media-assets.API01, API04)', () => {
  it('media-assets.IT01 / AC1 — a PDF uploads with 201 and reads back identically', async () => {
    const cookie = await signIn('one@example.test');
    const pdf = fixtureFile(FIXTURE_HEADERS.pdf, 4_000);

    const response = await upload(cookie, 'resume', pdf, '../../evil/cv.pdf');

    expect(response.status).toBe(201);
    const { asset } = (response.body as AssetBody).data;
    expect(asset).toMatchObject({ filename: 'cv.pdf', inUse: false });
    const content = await request(api.handler)
      .get(`/api/v1/cms/assets/${asset.id}/content`)
      .set('Cookie', cookie)
      .buffer(true)
      .parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => { callback(null, Buffer.concat(chunks)); });
      });
    expect(content.status).toBe(200);
    expect((content.body as Buffer).equals(pdf)).toBe(true);
    expect(content.headers).toMatchObject({
      'content-type': 'application/pdf',
      'x-content-type-options': 'nosniff',
      'cache-control': 'private, no-store',
    });
  });

  it('media-assets.IT02, IT03 / AC2, AC3 — wrong real type is 415 and nothing is stored', async () => {
    const cookie = await signIn('two@example.test');

    const png = await upload(cookie, 'resume', fixtureFile(FIXTURE_HEADERS.png));
    expect(png.status).toBe(415);
    expect(png.body).toMatchObject({ data: { code: 'UNSUPPORTED_MEDIA_TYPE', allowed: ['application/pdf'] } });
    expect((await upload(cookie, 'image', fixtureFile(FIXTURE_HEADERS.svg), 'x.svg', 'image/svg+xml')).status).toBe(415);
    await expect(assetModel(mongo.connection.getConnection()).countDocuments()).resolves.toBe(0);
    await expect(countFiles()).resolves.toBe(0);
  });

  it('media-assets.IT04 / AC4 — one byte over the limit is 413 with no document or chunks left', async () => {
    const cookie = await signIn('three@example.test');

    const response = await upload(cookie, 'resume', fixtureFile(FIXTURE_HEADERS.pdf, 5 * 1024 * 1024 + 1));

    expect(response.status).toBe(413);
    expect(response.body).toMatchObject({ data: { code: 'PAYLOAD_TOO_LARGE', maxBytes: 5 * 1024 * 1024 } });
    await expect(countFiles()).resolves.toBe(0);
  });

  it('media-assets.IT05, IT11 / AC6 — the same file twice (and in parallel) is one asset', async () => {
    const cookie = await signIn('four@example.test');
    const pdf = fixtureFile(FIXTURE_HEADERS.pdf, 900);

    const first = await upload(cookie, 'resume', pdf);
    const [again, parallel] = await Promise.all([upload(cookie, 'resume', pdf), upload(cookie, 'resume', pdf)]);

    expect(first.status).toBe(201);
    expect([again.status, parallel.status]).toEqual([200, 200]);
    const id = (first.body as AssetBody).data.asset.id;
    expect((again.body as AssetBody).data.asset.id).toBe(id);
    await expect(countFiles()).resolves.toBe(1);
  });

  it('media-assets.IT10 — malformed uploads are 400', async () => {
    const cookie = await signIn('five@example.test');

    expect((await upload(cookie, 'resume', Buffer.alloc(0))).status).toBe(400);
    expect((await upload(cookie, 'zip', fixtureFile(FIXTURE_HEADERS.pdf))).status).toBe(400);
    const noFile = await request(api.handler).post('/api/v1/cms/assets').set('Cookie', cookie).set('Origin', WEB_ORIGIN).field('kind', 'resume');
    expect(noFile.status).toBe(400);
    const json = await request(api.handler).post('/api/v1/cms/assets').set('Cookie', cookie).set('Origin', WEB_ORIGIN).send({ kind: 'resume' });
    expect(json.status).toBe(400);
  });
});

describe('list and delete (media-assets.API02, API03)', () => {
  it('media-assets.IT06, IT07, IT08 / AC7–AC9 — filter, inUse, guarded delete', async () => {
    const cookie = await signIn('six@example.test');
    const pdf = (await upload(cookie, 'resume', fixtureFile(FIXTURE_HEADERS.pdf))).body as AssetBody;
    const png = (await upload(cookie, 'image', fixtureFile(FIXTURE_HEADERS.png), 'a.png', 'image/png')).body as AssetBody;
    referenced.add(pdf.data.asset.id);

    const list = async (query: string) =>
      ((await request(api.handler).get(`/api/v1/cms/assets${query}`).set('Cookie', cookie)).body as {
        data: { assets: { id: string; inUse: boolean }[] };
      }).data.assets;
    expect((await list('')).map((a) => [a.id, a.inUse])).toEqual([
      [png.data.asset.id, false],
      [pdf.data.asset.id, true],
    ]);
    expect((await list('?kind=image')).map((a) => a.id)).toEqual([png.data.asset.id]);
    expect((await request(api.handler).get('/api/v1/cms/assets?kind=zip').set('Cookie', cookie)).status).toBe(400);

    const blocked = await request(api.handler).delete(`/api/v1/cms/assets/${pdf.data.asset.id}`).set('Cookie', cookie).set('Origin', WEB_ORIGIN);
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ data: { code: 'ASSET_IN_USE', usedBy: ['test reference'] } });

    const deleted = await request(api.handler).delete(`/api/v1/cms/assets/${png.data.asset.id}`).set('Cookie', cookie).set('Origin', WEB_ORIGIN);
    expect(deleted.body).toMatchObject({ data: { deleted: true } });
    expect((await request(api.handler).get(`/api/v1/cms/assets/${png.data.asset.id}/content`).set('Cookie', cookie)).status).toBe(404);
    await expect(countFiles()).resolves.toBe(1);
  });

  it('media-assets.IT09 / AC10 — every route without a session is 401', async () => {
    for (const response of [
      await request(api.handler).post('/api/v1/cms/assets').set('Origin', WEB_ORIGIN).field('kind', 'resume'),
      await request(api.handler).get('/api/v1/cms/assets'),
      await request(api.handler).delete('/api/v1/cms/assets/abc').set('Origin', WEB_ORIGIN),
      await request(api.handler).get('/api/v1/cms/assets/abc/content'),
    ]) {
      expect(response.status).toBe(401);
    }
  });

  it('media-assets.AC13 — another user cannot see, read or delete the asset', async () => {
    const owner = await signIn('owner-a@example.test');
    const other = await signIn('owner-b@example.test');
    const { id } = ((await upload(owner, 'resume', fixtureFile(FIXTURE_HEADERS.pdf))).body as AssetBody).data.asset;

    expect((await request(api.handler).get(`/api/v1/cms/assets/${id}/content`).set('Cookie', other)).status).toBe(404);
    expect((await request(api.handler).delete(`/api/v1/cms/assets/${id}`).set('Cookie', other).set('Origin', WEB_ORIGIN)).status).toBe(404);
    const listed = (await request(api.handler).get('/api/v1/cms/assets').set('Cookie', other)).body as { data: { assets: unknown[] } };
    expect(listed.data.assets).toEqual([]);
    expect((await request(api.handler).get(`/api/v1/cms/assets/${id}/content`).set('Cookie', owner)).status).toBe(200);
  });
});
