/**
 * `section-engine.API01`–`API06` end to end: the real container and app, a real `mongod`, a
 * real Redis and real sign-in (`section-engine.T05`; IT01–IT10, IT12–IT17). The container gets
 * test-only section definitions, so the engine is proven independently of the six real types
 * (`section-engine.test_cases.md`).
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import {
  FakeHeroDefinition,
  FakeSectionDefinition,
  MongoTestHarness,
  RecordingLogger,
  RecordingMailSender,
  RedisTestHarness,
} from '../../testing/index.js';
import { portfolioModel, sectionModel } from './portfolio.model.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';
const PASSWORD = 'a long sign-in password';
const VALID = { heading: 'Heading', items: [{ title: 'One' }], tags: [] as string[] };

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let api: ApiApplication;
let mail: RecordingMailSender;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  await portfolioModel(mongo.connection.getConnection()).init();
  await sectionModel(mongo.connection.getConnection()).init();
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
        JWT_ACCESS_SECRET: 'portfolio-routes-placeholder-secret-00000',
        WEB_ORIGIN,
      }),
      logger: new RecordingLogger(),
      mongo: mongo.connection,
      redis: redis.connection,
      mailSender: mail,
      sectionDefinitions: [
        new FakeHeroDefinition(),
        new FakeSectionDefinition('about'),
        new FakeSectionDefinition('work'),
      ],
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

/**
 * Registers a user through the real API, verifies the email with the code the recording
 * mailer captured — which signs in — and returns the `Cookie` header the browser would send.
 * Going through HTTP keeps this spec inside the `portfolio` module's boundary.
 */
async function signIn(email: string, displayName: string): Promise<string> {
  const registered = await request(api.handler)
    .post('/api/v1/auth/register')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password: PASSWORD, displayName });
  expect(registered.status).toBe(200);
  const code = /\b(\d{6})\b/.exec(mail.last?.text ?? '')?.[1] ?? '';
  const verified = await request(api.handler)
    .post('/api/v1/auth/register/verify')
    .set('Origin', WEB_ORIGIN)
    .send({ reference: (registered.body as { data: { reference: string } }).data.reference, otp: code });
  expect(verified.status).toBe(200);
  const lines = verified.headers['set-cookie'] as unknown as string[];
  return lines.map((line) => line.slice(0, line.indexOf(';'))).join('; ');
}

function get(path: string, cookie: string): request.Test {
  return request(api.handler).get(`/api/v1/cms${path}`).set('Cookie', cookie);
}

function write(method: 'put' | 'patch', path: string, cookie: string, body: object): request.Test {
  return request(api.handler)[method](`/api/v1/cms${path}`).set('Cookie', cookie).set('Origin', WEB_ORIGIN).send(body);
}

interface Draft {
  portfolio: { id: string; slug: string; revision: number; sectionOrder: string[] };
  sections: { type: string; visible: boolean; revision: number; data: { heading?: string; items?: { id: string }[] } }[];
}

async function draft(cookie: string): Promise<Draft> {
  const response = await get('/portfolio', cookie);
  expect(response.status).toBe(200);
  return (response.body as { data: Draft }).data;
}

describe('provisioning and reads (section-engine.API01, API02)', () => {
  it('section-engine.IT15 / AC15 — the first read provisions once; parallel first reads leave one', async () => {
    const ann = await signIn('ann@example.test', 'Ann Lee');

    const first = await draft(ann);
    const second = await draft(ann);

    expect(second.portfolio).toEqual(first.portfolio);
    expect(first.portfolio).toMatchObject({ slug: 'ann-lee', revision: 1, sectionOrder: ['about', 'work'] });
    expect(first.sections.map((section) => [section.type, section.visible, section.revision])).toEqual([
      ['hero', true, 1],
      ['about', true, 1],
      ['work', true, 1],
    ]);

    const bo = await signIn('bo@example.test', 'Bo');
    await Promise.all([draft(bo), draft(bo), draft(bo)]);
    await expect(portfolioModel(mongo.connection.getConnection()).countDocuments()).resolves.toBe(2);
  });

  it('section-engine.API02 — lists the type flags', async () => {
    const response = await get('/portfolio/section-types', await signIn('t@example.test', 'T'));

    expect((response.body as { data: { types: unknown[] } }).data.types).toHaveLength(3);
  });

  it('section-engine.IT12 — every route without a session is 401', async () => {
    for (const response of [
      await get('/portfolio', ''),
      await get('/portfolio/section-types', ''),
      await write('put', '/portfolio/sections/about', '', { expectedRevision: 1, data: VALID }),
      await write('patch', '/portfolio/sections/about/visibility', '', { expectedRevision: 1, visible: false }),
      await write('put', '/portfolio/section-order', '', { expectedRevision: 1, order: [] }),
      await write('put', '/portfolio/slug', '', { expectedRevision: 1, slug: 'abc' }),
    ]) {
      expect(response.status).toBe(401);
    }
  });
});

describe('PUT /cms/portfolio/sections/:type (section-engine.API03)', () => {
  it('section-engine.IT02, IT07, IT14 — saves cleaned data, assigns ids, drops unknown keys, increments one revision', async () => {
    const cookie = await signIn('a@example.test', 'A');
    await draft(cookie);

    const response = await write('put', '/portfolio/sections/about', cookie, {
      expectedRevision: 1,
      data: { ...VALID, heading: '<script>x</script>Tab\there', extra: true },
    });

    expect(response.status).toBe(200);
    const section = (response.body as { data: { section: Draft['sections'][number] } }).data.section;
    expect(section).toMatchObject({ type: 'about', revision: 2, data: { heading: 'xTab here' } });
    expect(section.data.items?.[0]?.id).toMatch(/^[\w-]{12}$/);
    const stored = await sectionModel(mongo.connection.getConnection()).findOne({ type: 'about' }).lean().exec();
    expect(stored?.data).not.toHaveProperty('extra');
    const after = await draft(cookie);
    expect(after.sections.find((s) => s.type === 'work')?.revision).toBe(1);
  });

  it('section-engine.IT03, IT04 — stale and concurrent saves: exactly one wins', async () => {
    const cookie = await signIn('c@example.test', 'C');
    await draft(cookie);

    const results = await Promise.all([
      write('put', '/portfolio/sections/about', cookie, { expectedRevision: 1, data: { ...VALID, heading: 'First' } }),
      write('put', '/portfolio/sections/about', cookie, { expectedRevision: 1, data: { ...VALID, heading: 'Second' } }),
    ]);

    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(loser?.body).toMatchObject({ data: { code: 'REVISION_CONFLICT', currentRevision: 2 } });
  });

  it('section-engine.IT05, IT06 — 400 with relative paths; 404 for an unregistered type', async () => {
    const cookie = await signIn('v@example.test', 'V');
    await draft(cookie);

    const invalid = await write('put', '/portfolio/sections/about', cookie, { expectedRevision: 1, data: { heading: '' } });
    expect(invalid.status).toBe(400);
    const paths = (invalid.body as { data: { errors: { path: string }[] } }).data.errors.map((e) => e.path);
    expect(paths).toEqual(expect.arrayContaining(['heading', 'items', 'tags']));

    expect((await write('put', '/portfolio/sections/nope', cookie, { expectedRevision: 1, data: VALID })).status).toBe(404);
    expect((await write('put', '/portfolio/sections/about', cookie, { data: VALID })).status).toBe(400);
  });

  it('refuses a write without the web origin', async () => {
    const cookie = await signIn('o@example.test', 'O');
    const response = await request(api.handler)
      .put('/api/v1/cms/portfolio/sections/about')
      .set('Cookie', cookie)
      .send({ expectedRevision: 1, data: VALID });

    expect(response.status).toBe(403);
  });
});

describe('visibility, order and slug (section-engine.API04–API06)', () => {
  it('section-engine.IT08, IT09 — hide and show keep data; hero is not hideable', async () => {
    const cookie = await signIn('h@example.test', 'H');
    await draft(cookie);

    expect((await write('patch', '/portfolio/sections/about/visibility', cookie, { expectedRevision: 1, visible: false })).status).toBe(200);
    const shown = await write('patch', '/portfolio/sections/about/visibility', cookie, { expectedRevision: 2, visible: true });
    expect(shown.body).toMatchObject({ data: { section: { visible: true, revision: 3, data: { heading: '[Your heading]' } } } });

    const hero = await write('patch', '/portfolio/sections/hero/visibility', cookie, { expectedRevision: 1, visible: false });
    expect(hero.status).toBe(409);
    expect(hero.body).toMatchObject({ data: { code: 'SECTION_NOT_HIDEABLE' } });
  });

  it('section-engine.IT10 — reorders, then refuses a stale revision and a bad permutation', async () => {
    const cookie = await signIn('r@example.test', 'R');
    await draft(cookie);

    const ok = await write('put', '/portfolio/section-order', cookie, { expectedRevision: 1, order: ['work', 'about'] });
    expect(ok.body).toMatchObject({ data: { portfolio: { revision: 2, sectionOrder: ['work', 'about'] } } });
    expect((await write('put', '/portfolio/section-order', cookie, { expectedRevision: 1, order: ['about', 'work'] })).status).toBe(409);
    expect((await write('put', '/portfolio/section-order', cookie, { expectedRevision: 2, order: ['hero', 'about', 'work'] })).status).toBe(400);
  });

  it('section-engine.IT17 / AC17 — slug: valid, reserved, taken, malformed, stale', async () => {
    const mine = await signIn('s1@example.test', 'Mine');
    const theirs = await signIn('s2@example.test', 'Theirs');
    await draft(mine);
    await draft(theirs);

    expect((await write('put', '/portfolio/slug', mine, { expectedRevision: 1, slug: 'ghulam' })).status).toBe(200);
    const reserved = await write('put', '/portfolio/slug', mine, { expectedRevision: 2, slug: 'admin' });
    expect(reserved.body).toMatchObject({ data: { code: 'SLUG_TAKEN' } });
    const taken = await write('put', '/portfolio/slug', mine, { expectedRevision: 2, slug: 'theirs' });
    expect(taken.body).toMatchObject({ data: { code: 'SLUG_TAKEN' } });
    expect((await write('put', '/portfolio/slug', mine, { expectedRevision: 2, slug: 'Bad Slug' })).status).toBe(400);
    expect((await write('put', '/portfolio/slug', mine, { expectedRevision: 1, slug: 'other' })).body).toMatchObject({
      data: { code: 'REVISION_CONFLICT', currentRevision: 2 },
    });
  });
});

describe('tenant isolation (section-engine.AC16)', () => {
  it('section-engine.IT16 — A edits, hides, reorders and renames; B is untouched', async () => {
    const a = await signIn('iso-a@example.test', 'Iso A');
    const b = await signIn('iso-b@example.test', 'Iso B');
    await draft(a);
    const before = await draft(b);
    const bSections = await sectionModel(mongo.connection.getConnection())
      .find({ portfolioId: before.portfolio.id })
      .lean()
      .exec();

    await write('put', '/portfolio/sections/about', a, { expectedRevision: 1, data: { ...VALID, heading: 'A only' } });
    await write('patch', '/portfolio/sections/work/visibility', a, { expectedRevision: 1, visible: false });
    await write('put', '/portfolio/section-order', a, { expectedRevision: 1, order: ['work', 'about'] });
    await write('put', '/portfolio/slug', a, { expectedRevision: 2, slug: 'iso-a-renamed' });

    const after = await draft(b);
    expect(after).toEqual(before);
    const bSectionsAfter = await sectionModel(mongo.connection.getConnection())
      .find({ portfolioId: before.portfolio.id })
      .lean()
      .exec();
    expect(bSectionsAfter).toEqual(bSections);
  });
});
