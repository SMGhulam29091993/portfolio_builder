/**
 * `publish-pipeline.API01`–`API06` end to end: real MongoDB, real Redis, every content module
 * wired, the seeded owner (`publish-pipeline.T08`; IT01–IT13, IT15–IT19, AC21).
 */
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer, buildSeeders } from '../../container.js';
import { MongoTestHarness, RecordingLogger, RecordingMailSender, RedisTestHarness, SEED_PLACEHOLDER } from '../../testing/index.js';
import { snapshotModel } from './snapshot.model.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';
const OWNER = { email: 'owner@example.test', password: 'a publishing test password' };
const BASE = '/api/v1/cms/publishing';

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let mail: RecordingMailSender;
let api: ApiApplication;

function env(extra: Record<string, string> = {}) {
  return loadEnv({
    NODE_ENV: 'test',
    PORT: '4100',
    MONGODB_URI: mongo.uri,
    REDIS_URL: redis.url,
    JWT_ACCESS_SECRET: 'publishing-routes-placeholder-secret-000',
    WEB_ORIGIN,
    OWNER_EMAIL: OWNER.email,
    OWNER_PASSWORD: OWNER.password,
    ...extra,
  });
}

function app(extra: Record<string, string> = {}): ApiApplication {
  return createApp(
    buildContainer({ env: env(extra), logger: new RecordingLogger(), mongo: mongo.connection, redis: redis.connection, mailSender: mail }),
  );
}

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  await snapshotModel(mongo.connection.getConnection()).init();
});
beforeEach(async () => {
  mail = new RecordingMailSender();
  api = app();
  await buildSeeders({ env: env(), mongo: mongo.connection }).all.run();
});
afterEach(async () => {
  await mongo.reset();
  await redis.reset();
});
afterAll(async () => {
  await mongo.stop();
  await redis.stop();
});

/** Session cookies of the seeded owner. */
async function signInOwner(target = api): Promise<string> {
  const response = await request(target.handler).post('/api/v1/auth/login').set('Origin', WEB_ORIGIN).send(OWNER);
  expect(response.status).toBe(200);
  return cookiesOf(response.headers['set-cookie']);
}

/** Session cookies of a freshly registered user, whose portfolio is the template. */
async function signInNewUser(email: string): Promise<string> {
  const registered = await request(api.handler)
    .post('/api/v1/auth/register')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password: 'a template test password', displayName: 'Tess Template' });
  const code = /\b(\d{6})\b/.exec(mail.last?.text ?? '')?.[1] ?? '';
  const verified = await request(api.handler)
    .post('/api/v1/auth/register/verify')
    .set('Origin', WEB_ORIGIN)
    .send({ reference: (registered.body as { data: { reference: string } }).data.reference, otp: code });
  return cookiesOf(verified.headers['set-cookie']);
}

function cookiesOf(header: unknown): string {
  return (header as string[]).map((line) => line.slice(0, line.indexOf(';'))).join('; ');
}

interface Issue {
  rule: string;
  severity: string;
  path: string;
}

const get = (cookie: string, path: string, target = api) => request(target.handler).get(`${BASE}${path}`).set('Cookie', cookie);
const post = (cookie: string, path: string, body: object = {}, target = api) =>
  request(target.handler).post(`${BASE}${path}`).set('Cookie', cookie).set('Origin', WEB_ORIGIN).send(body);

async function validate(cookie: string, target = api) {
  return (await post(cookie, '/validate', {}, target)).body as { data: { publishable: boolean; draftContentHash: string; issues: Issue[] } };
}

/** Validates, then publishes with the returned hash. */
async function publish(cookie: string, note?: string, target = api) {
  const { data } = await validate(cookie, target);
  return post(cookie, '/publish', { expectedDraftHash: data.draftContentHash, ...(note ? { note } : {}) }, target);
}

async function draft(cookie: string) {
  return (await request(api.handler).get('/api/v1/cms/portfolio').set('Cookie', cookie)).body as {
    data: { portfolio: { revision: number; sectionOrder: string[] }; sections: { type: string; revision: number; data: Record<string, unknown> }[] };
  };
}

/** Replaces the seed's placeholder (or anything else) in the work section through the API. */
async function editWork(cookie: string, edit: (data: { projects: { description: string }[] }) => void) {
  const work = (await draft(cookie)).data.sections.find((section) => section.type === 'work');
  if (!work) throw new Error('fixture');
  const data = structuredClone(work.data) as { projects: { description: string }[] };
  edit(data);
  const saved = await request(api.handler)
    .put('/api/v1/cms/portfolio/sections/work')
    .set('Cookie', cookie)
    .set('Origin', WEB_ORIGIN)
    .send({ expectedRevision: work.revision, data });
  expect(saved.status).toBe(200);
}

const fixPlaceholder = (cookie: string) =>
  editWork(cookie, (data) => {
    const project = data.projects[3];
    if (!project) throw new Error('fixture');
    project.description = project.description.replace(SEED_PLACEHOLDER, 'A second brain for notes.');
  });

const snapshots = () => snapshotModel(mongo.connection.getConnection());

describe('publishing routes', () => {
  it('publish-pipeline.IT16 — every route without a session is 401', async () => {
    const calls = [
      request(api.handler).get(`${BASE}/status`),
      request(api.handler).post(`${BASE}/validate`).set('Origin', WEB_ORIGIN),
      request(api.handler).post(`${BASE}/publish`).set('Origin', WEB_ORIGIN).send({ expectedDraftHash: 'a'.repeat(64) }),
      request(api.handler).get(`${BASE}/snapshots`),
      request(api.handler).post(`${BASE}/snapshots/1/activate`).set('Origin', WEB_ORIGIN),
      request(api.handler).post(`${BASE}/revalidate`).set('Origin', WEB_ORIGIN),
    ];
    for (const response of await Promise.all(calls)) expect(response.status).toBe(401);
  });

  it('publish-pipeline.IT01, IT02, IT19 — the seed: unpublished; publishing it is 422 with exactly one error; validate writes nothing', async () => {
    const cookie = await signInOwner();
    expect((await get(cookie, '/status')).body).toMatchObject({ data: { published: null, hasUnpublishedChanges: true, revalidation: null } });

    const collections = mongo.connection.getConnection().db;
    if (!collections) throw new Error('no database');
    const names = (await collections.listCollections().toArray()).map((collection) => collection.name).sort();
    const before = await Promise.all(names.map((name) => collections.collection(name).find().toArray()));
    const report = await validate(cookie);
    expect(await Promise.all(names.map((name) => collections.collection(name).find().toArray()))).toEqual(before);

    expect(report.data.publishable).toBe(false);
    const errors = report.data.issues.filter((issue) => issue.severity === 'error');
    expect(errors).toEqual([expect.objectContaining({ rule: 'no-placeholder-text', path: 'sections.work.projects[3].description' })]);

    const blocked = await publish(cookie);
    expect(blocked.status).toBe(422);
    expect(blocked.body).toMatchObject({ data: { code: 'PUBLISH_BLOCKED' } });
    expect((blocked.body as { data: { issues: Issue[] } }).data.issues.filter((issue) => issue.severity === 'error')).toHaveLength(1);
    expect(await snapshots().countDocuments()).toBe(0);
  });

  it('publish-pipeline.IT03, IT18, IT09 — fix the placeholder and publish: 201 v1, warnings, revalidation ok, status clean', async () => {
    const cookie = await signInOwner();
    await fixPlaceholder(cookie);
    const published = await publish(cookie, 'First version');
    expect(published.status).toBe(201);
    expect(published.body).toMatchObject({ data: { snapshot: { version: 1 }, revalidation: 'ok' } });
    expect((published.body as { data: { warnings: Issue[] } }).data.warnings.map((issue) => issue.rule)).toEqual(['resume-missing']);
    expect((await get(cookie, '/status')).body).toMatchObject({
      data: { published: { version: 1 }, hasUnpublishedChanges: false, revalidation: { status: 'ok' } },
    });
  });

  it('publish-pipeline.IT04, IT05, IT06 — stale hash, nothing to publish, and an untouched snapshot after an edit', async () => {
    const cookie = await signInOwner();
    await fixPlaceholder(cookie);
    const { data } = await validate(cookie);
    expect((await post(cookie, '/publish', { expectedDraftHash: data.draftContentHash })).status).toBe(201);
    const stored = await snapshots().findOne().lean().exec();

    expect((await publish(cookie)).body).toMatchObject({ data: { code: 'NOTHING_TO_PUBLISH' } });

    const { data: checked } = await validate(cookie);
    await editWork(cookie, (work) => {
      if (work.projects[0]) work.projects[0].description = 'Edited after validating.';
    });
    const stale = await post(cookie, '/publish', { expectedDraftHash: checked.draftContentHash });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ data: { code: 'DRAFT_CHANGED', draftContentHash: expect.stringMatching(/^[0-9a-f]{64}$/) as unknown } });
    expect(await snapshots().countDocuments()).toBe(1);
    expect((await snapshots().findOne().lean().exec())?.content).toEqual(stored?.content);
    expect((await get(cookie, '/status')).body).toMatchObject({ data: { hasUnpublishedChanges: true } });
  });

  it('publish-pipeline.IT07 — a hidden section is left out and the custom order is kept', async () => {
    const cookie = await signInOwner();
    await fixPlaceholder(cookie);
    const { data } = await draft(cookie);
    const stack = data.sections.find((section) => section.type === 'stack');
    await request(api.handler)
      .patch('/api/v1/cms/portfolio/sections/stack/visibility')
      .set('Cookie', cookie)
      .set('Origin', WEB_ORIGIN)
      .send({ expectedRevision: stack?.revision, visible: false });
    const order = [...data.portfolio.sectionOrder].reverse();
    await request(api.handler)
      .put('/api/v1/cms/portfolio/section-order')
      .set('Cookie', cookie)
      .set('Origin', WEB_ORIGIN)
      .send({ expectedRevision: data.portfolio.revision, order });
    expect((await publish(cookie)).status).toBe(201);
    const types = ((await snapshots().findOne().lean().exec())?.content as { sections: { type: string }[] }).sections.map((section) => section.type);
    expect(types).toEqual(['hero', ...order.filter((type) => type !== 'stack')]);
  });

  it('publish-pipeline.IT08 — a CTA to a hidden section and a missing asset: one 422 listing both rules', async () => {
    const cookie = await signInOwner();
    await fixPlaceholder(cookie);
    const contact = (await draft(cookie)).data.sections.find((section) => section.type === 'contact');
    await request(api.handler)
      .patch('/api/v1/cms/portfolio/sections/contact/visibility')
      .set('Cookie', cookie)
      .set('Origin', WEB_ORIGIN)
      .send({ expectedRevision: contact?.revision, visible: false });
    // The identity API refuses unknown asset ids, so the dangling reference is planted directly.
    await mongo.connection.getConnection().collection('identities').updateOne({}, { $set: { 'data.resume.assetId': 'gone' } });
    const blocked = await publish(cookie);
    expect(blocked.status).toBe(422);
    const rules = (blocked.body as { data: { issues: Issue[] } }).data.issues.filter((issue) => issue.severity === 'error').map((issue) => issue.rule);
    expect(rules.sort()).toEqual(['assets-resolve', 'internal-links-resolve']);
  });

  it('publish-pipeline.IT11, IT12 — history, then make version 1 live; current is 409 and unknown is 404', async () => {
    const cookie = await signInOwner();
    await fixPlaceholder(cookie);
    for (const text of ['One', 'Two', 'Three']) {
      await editWork(cookie, (work) => {
        if (work.projects[0]) work.projects[0].description = `Version ${text}.`;
      });
      expect((await publish(cookie, text)).status).toBe(201);
    }
    const page = (await get(cookie, '/snapshots?limit=2')).body as { data: { snapshots: { version: number; isCurrent: boolean; note: string }[]; nextCursor: string } };
    expect(page.data.snapshots.map((row) => [row.version, row.isCurrent, row.note])).toEqual([[3, true, 'Three'], [2, false, 'Two']]);
    expect(((await get(cookie, `/snapshots?cursor=${page.data.nextCursor}`)).body as { data: { snapshots: unknown[] } }).data.snapshots).toHaveLength(1);
    expect((await get(cookie, '/snapshots?limit=99')).status).toBe(400);

    const contents = (await snapshots().find().sort({ version: 1 }).lean().exec()).map((row) => row.content);
    const sectionsBefore = await mongo.connection.getConnection().collection('sections').find().toArray();
    const activated = await post(cookie, '/snapshots/1/activate');
    expect(activated.status).toBe(200);
    expect(activated.body).toMatchObject({ data: { snapshot: { version: 1 }, revalidation: 'ok' } });
    expect((await get(cookie, '/status')).body).toMatchObject({ data: { published: { version: 1 }, hasUnpublishedChanges: true } });
    expect((await snapshots().find().sort({ version: 1 }).lean().exec()).map((row) => row.content)).toEqual(contents);
    expect(await mongo.connection.getConnection().collection('sections').find().toArray()).toEqual(sectionsBefore);

    expect((await post(cookie, '/snapshots/1/activate')).body).toMatchObject({ data: { code: 'ALREADY_CURRENT' } });
    expect((await post(cookie, '/snapshots/99/activate')).status).toBe(404);
    expect((await post(cookie, '/snapshots/abc/activate')).status).toBe(400);
  });

  it('publish-pipeline.IT13 — two publishes in parallel: one 201, one 409; versions unique', async () => {
    const cookie = await signInOwner();
    await fixPlaceholder(cookie);
    const { data } = await validate(cookie);
    const body = { expectedDraftHash: data.draftContentHash };
    const results = await Promise.all([post(cookie, '/publish', body), post(cookie, '/publish', body)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    // Fully serialised requests see the first as live (NOTHING_TO_PUBLISH); interleaved ones race
    // on the pointer (PUBLISH_CONFLICT). Either way exactly one version went live.
    const loser = results.find((result) => result.status === 409)?.body as { data: { code: string } };
    expect(['PUBLISH_CONFLICT', 'NOTHING_TO_PUBLISH']).toContain(loser.data.code);
    const versions = (await snapshots().find().lean().exec()).map((row) => row.version);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('publish-pipeline.IT15 / AC18 — an asset in a snapshot cannot be deleted', async () => {
    const cookie = await signInOwner();
    await fixPlaceholder(cookie);
    const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(64, 1)]);
    const uploaded = await request(api.handler)
      .post('/api/v1/cms/assets')
      .set('Cookie', cookie)
      .set('Origin', WEB_ORIGIN)
      .field('kind', 'resume')
      .attach('file', pdf, { filename: 'cv.pdf', contentType: 'application/pdf' });
    const assetId = (uploaded.body as { data: { asset: { id: string } } }).data.asset.id;
    const identity = ((await request(api.handler).get('/api/v1/cms/identity').set('Cookie', cookie)).body as {
      data: { identity: { revision: number; data: { resume: { assetId: string | null; label: string } } } };
    }).data.identity;
    const save = (assetIdValue: string | null, revision: number) =>
      request(api.handler)
        .put('/api/v1/cms/identity')
        .set('Cookie', cookie)
        .set('Origin', WEB_ORIGIN)
        .send({ expectedRevision: revision, data: { ...identity.data, resume: { ...identity.data.resume, assetId: assetIdValue } } });
    expect((await save(assetId, identity.revision)).status).toBe(200);
    const published = await publish(cookie);
    expect(published.status).toBe(201);
    expect((published.body as { data: { warnings: Issue[] } }).data.warnings).toEqual([]);
    expect((await save(null, identity.revision + 1)).status).toBe(200);

    const blocked = await request(api.handler).delete(`/api/v1/cms/assets/${assetId}`).set('Cookie', cookie).set('Origin', WEB_ORIGIN);
    expect(blocked.status).toBe(409);
    expect(blocked.body).toMatchObject({ data: { code: 'ASSET_IN_USE', usedBy: ['published snapshots'] } });
  });

  it('publish-pipeline.AC21 and tenant isolation — a template portfolio is blocked; another user sees nothing of the owner', async () => {
    const owner = await signInOwner();
    await fixPlaceholder(owner);
    expect((await publish(owner)).status).toBe(201);

    const tess = await signInNewUser('tess@example.test');
    expect((await get(tess, '/status')).body).toMatchObject({ data: { published: null } });
    expect((await get(tess, '/snapshots')).body).toMatchObject({ data: { snapshots: [], nextCursor: null } });
    expect((await post(tess, '/snapshots/1/activate')).status).toBe(404);
    expect((await post(tess, '/revalidate')).body).toMatchObject({ data: { code: 'NOTHING_PUBLISHED' } });

    const blocked = await publish(tess);
    expect(blocked.status).toBe(422);
    const paths = (blocked.body as { data: { issues: Issue[] } }).data.issues.filter((issue) => issue.rule === 'no-placeholder-text').map((issue) => issue.path);
    expect(paths.some((path) => path.startsWith('identity.'))).toBe(true);
    expect(paths.some((path) => path.startsWith('sections.hero.'))).toBe(true);
  });
});

describe('site revalidation over HTTP (publish-pipeline.IT10)', () => {
  let server: Server;
  let answer = 200;
  const secrets: (string | undefined)[] = [];

  beforeAll(async () => {
    server = createServer((req, res) => {
      secrets.push(req.headers['x-revalidate-secret'] as string | undefined);
      req.resume();
      req.on('end', () => res.writeHead(answer).end());
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });

  it('ok on 200; failed on 500 with 201 still returned; API06 then ok', async () => {
    const secret = 'shared-revalidation-secret-for-tests-0000';
    const target = app({
      WEB_REVALIDATE_URL: `http://127.0.0.1:${String((server.address() as AddressInfo).port)}/api/revalidate`,
      REVALIDATE_SECRET: secret,
    });
    const cookie = await signInOwner(target);
    await fixPlaceholder(cookie);
    answer = 500;
    const published = await publish(cookie, undefined, target);
    expect(published.status).toBe(201);
    expect(published.body).toMatchObject({ data: { revalidation: 'failed' } });
    expect((await get(cookie, '/status', target)).body).toMatchObject({ data: { revalidation: { status: 'failed' } } });
    answer = 200;
    expect((await post(cookie, '/revalidate', {}, target)).body).toMatchObject({ data: { revalidation: 'ok' } });
    expect(secrets.every((value) => value === secret)).toBe(true);
    expect((await snapshots().findOne().lean().exec())?.delivery).toMatchObject({ status: 'ok', attempts: 2 });
  });
});

describe('revalidation configuration (publish-pipeline.IT17)', () => {
  it('production without WEB_REVALIDATE_URL fails startup naming it; a URL without the secret names the secret', () => {
    const build = (extra: Record<string, string>) => () =>
      buildContainer({ env: env(extra), logger: new RecordingLogger(), mongo: mongo.connection, redis: redis.connection, mailSender: mail });
    expect(build({ NODE_ENV: 'production' })).toThrow(/WEB_REVALIDATE_URL/);
    expect(build({ WEB_REVALIDATE_URL: 'http://127.0.0.1:1/api/revalidate' })).toThrow(/REVALIDATE_SECRET/);
  });
});
