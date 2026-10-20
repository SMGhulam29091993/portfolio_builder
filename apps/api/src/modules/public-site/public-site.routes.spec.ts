/**
 * `public-site-rendering.API01`, `API02`, `API04` end to end: real MongoDB and Redis, content
 * published through the CMS routes (`public-site-rendering.T01`; IT01–IT08, IT10–IT12).
 */
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer, buildSeeders } from '../../container.js';
import { CmsTestClient, FIXTURE_HEADERS, fixtureFile, MongoTestHarness, RecordingLogger, RecordingMailSender, RedisTestHarness } from '../../testing/index.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';
const OWNER = { email: 'owner@example.test', password: 'a public site test password' };

let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let mail: RecordingMailSender;
let api: ApiApplication;

function env() {
  return loadEnv({
    NODE_ENV: 'test',
    PORT: '4100',
    MONGODB_URI: mongo.uri,
    REDIS_URL: redis.url,
    JWT_ACCESS_SECRET: 'public-site-routes-placeholder-secret-00',
    WEB_ORIGIN,
    OWNER_EMAIL: OWNER.email,
    OWNER_PASSWORD: OWNER.password,
  });
}

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
});
beforeEach(async () => {
  mail = new RecordingMailSender();
  api = createApp(buildContainer({ env: env(), logger: new RecordingLogger(), mongo: mongo.connection, redis: redis.connection, mailSender: mail }));
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

const publicGet = (path: string) => request(api.handler).get(`/api/v1/public${path}`);

async function publishedOwner(): Promise<{ owner: CmsTestClient; slug: string }> {
  const owner = await CmsTestClient.signIn(api, WEB_ORIGIN, OWNER);
  await owner.fixSeedPlaceholder();
  expect((await owner.publish()).status).toBe(201);
  return { owner, slug: await owner.slug() };
}

interface PortfolioBody {
  data: { slug: string; version: number; content: { identity: { roleTitle: string }; assets: { id: string; filename: string }[] } };
}

describe('public site routes', () => {
  it('public-site-rendering.IT01 — unpublished and unknown slugs are the same 404', async () => {
    const owner = await CmsTestClient.signIn(api, WEB_ORIGIN, OWNER);
    const unpublished = await publicGet(`/portfolios/${await owner.slug()}`);
    const unknown = await publicGet('/portfolios/no-such-portfolio');
    expect(unpublished.status).toBe(404);
    expect(unknown.status).toBe(404);
    expect(unpublished.body).toEqual(unknown.body);
    expect((await publicGet('/portfolios/Not_A_Slug')).status).toBe(400);
  });

  it('public-site-rendering.IT02, IT03, IT04 — the live snapshot with its ETag; 304 on a match; draft edits invisible', async () => {
    const { owner, slug } = await publishedOwner();
    const first = await publicGet(`/portfolios/${slug}`);
    expect(first.status).toBe(200);
    expect(first.headers.etag).toMatch(/^"[0-9a-f]{64}"$/);
    expect(first.headers['cache-control']).toBe('public, max-age=0, must-revalidate');
    expect((first.body as PortfolioBody).data).toMatchObject({ slug, version: 1 });

    const cached = await publicGet(`/portfolios/${slug}`).set('If-None-Match', String(first.headers.etag));
    expect(cached.status).toBe(304);
    expect(cached.text).toBe('');

    const role = (first.body as PortfolioBody).data.content.identity.roleTitle;
    await owner.editSection('about', (data) => {
      (data as { bio: string }).bio = 'A draft edit nobody may see.';
    });
    const after = await publicGet(`/portfolios/${slug}`);
    expect(after.headers.etag).toBe(first.headers.etag);
    expect(JSON.stringify(after.body)).not.toContain('A draft edit nobody may see.');
    expect((after.body as PortfolioBody).data.content.identity.roleTitle).toBe(role);
  });

  it('public-site-rendering.IT05–IT08 — only files of the live snapshot, under their exact name', async () => {
    const owner = await CmsTestClient.signIn(api, WEB_ORIGIN, OWNER);
    const slug = await owner.slug();
    const bytes = fixtureFile(FIXTURE_HEADERS.pdf);
    const resume = await owner.upload('resume', bytes, 'cv.pdf');
    expect((await publicGet(`/portfolios/${slug}/assets/${resume}/cv.pdf`)).status).toBe(404);

    await owner.fixSeedPlaceholder();
    await owner.setResume(resume);
    expect((await owner.publish()).status).toBe(201);
    const listed = ((await publicGet(`/portfolios/${slug}`)).body as PortfolioBody).data.content.assets[0];
    if (!listed) throw new Error('no asset in the snapshot');

    const file = await publicGet(`/portfolios/${slug}/assets/${listed.id}/${encodeURIComponent(listed.filename)}`).buffer(true);
    expect(file.status).toBe(200);
    expect(file.headers).toMatchObject({
      'content-type': 'application/pdf',
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
      'content-disposition': `inline; filename="${listed.filename}"`,
    });
    expect(Buffer.from(file.body as Buffer).equals(bytes)).toBe(true);
    const again = await publicGet(`/portfolios/${slug}/assets/${listed.id}/${encodeURIComponent(listed.filename)}`).set('If-None-Match', String(file.headers.etag));
    expect(again.status).toBe(304);

    expect((await publicGet(`/portfolios/${slug}/assets/${listed.id}/other.pdf`)).status).toBe(404);

    await owner.setResume(null);
    expect((await owner.publish()).status).toBe(201);
    expect((await publicGet(`/portfolios/${slug}/assets/${listed.id}/${encodeURIComponent(listed.filename)}`)).status).toBe(404);
  });

  it('public-site-rendering.IT11, IT12 — each slug serves its own snapshot; no cross-portfolio files; API04 lists the published only', async () => {
    const { owner, slug } = await publishedOwner();
    const other = await CmsTestClient.register(api, WEB_ORIGIN, mail, 'other@example.test');
    const otherSlug = await other.slug();
    const otherFile = await other.upload('resume', fixtureFile(FIXTURE_HEADERS.pdf), 'other.pdf');

    expect((await publicGet(`/portfolios/${otherSlug}`)).status).toBe(404);
    expect((await publicGet(`/portfolios/${slug}/assets/${otherFile}/other.pdf`)).status).toBe(404);
    expect((await publicGet('/portfolios')).body).toMatchObject({ data: { portfolios: [{ slug }] } });
    expect(((await publicGet('/portfolios')).body as { data: { portfolios: unknown[] } }).data.portfolios).toHaveLength(1);
    expect(owner.cookie).not.toBe(other.cookie);
  });

  it('public-site-rendering.IT10 — the public rate limit answers 429 with Retry-After', async () => {
    let response = await publicGet('/portfolios');
    for (let sent = 1; sent <= 600 && response.status !== 429; sent += 1) response = await publicGet('/portfolios');
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toMatch(/^\d+$/);
  });
});
