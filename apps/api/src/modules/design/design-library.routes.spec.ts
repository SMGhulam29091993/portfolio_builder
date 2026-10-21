/**
 * `design-library.API01`–`API06` end to end (`design-library.T03`; IT01–IT03; AC2, AC5, AC6)
 * against real MongoDB and Redis and the real container.
 */
import { DEFAULT_DESIGN, LAYOUT_BLOCKS, type CustomLayout } from '@portfolio/design-tokens';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer } from '../../container.js';
import { CmsTestClient, MongoTestHarness, RecordingLogger, RecordingMailSender, RedisTestHarness } from '../../testing/index.js';
import { LayoutLibraryRepository } from './layout-library.repository.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';
let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let api: ApiApplication;
let mail: RecordingMailSender;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
});
beforeEach(() => {
  mail = new RecordingMailSender();
  api = createApp(
    buildContainer({
      env: loadEnv({ NODE_ENV: 'test', PORT: '4100', MONGODB_URI: mongo.uri, REDIS_URL: redis.url, JWT_ACCESS_SECRET: 'design-library-placeholder-secret-000000', WEB_ORIGIN }),
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

function stacked(section: CustomLayout['section']): CustomLayout {
  const children = Object.entries(LAYOUT_BLOCKS[section]).map(([block, styles]) => ({ kind: 'block' as const, block, style: styles[0] ?? null }));
  return { section, align: 'center', body: { kind: 'stack', gap: 'md', columns: null, children } };
}

/** A library layout for the client's portfolio, stored the way an applied proposal stores it. */
async function seedLayout(client: CmsTestClient, section: CustomLayout['section']): Promise<string> {
  const portfolioId = ((await client.get('/cms/portfolio')).body as { data: { portfolio: { id: string } } }).data.portfolio.id;
  const [stored] = await new LayoutLibraryRepository(mongo.connection).insertMany(portfolioId, [{ name: `${section} layout`, layout: stacked(section), source: 'ai' }], new Date());
  return stored?.id ?? '';
}

const saveDesign = (client: CmsTestClient, expectedRevision: number, layout: Record<string, string>) =>
  client.send('put', '/cms/design', { expectedRevision, theme: DEFAULT_DESIGN.theme, layout: { ...DEFAULT_DESIGN.layout, ...layout } });

describe('design library routes', () => {
  it('design-library.IT01 / AC2 — a design may name only this portfolio’s layout for that section', async () => {
    const client = await CmsTestClient.register(api, WEB_ORIGIN, mail, 'one@example.test');
    const other = await CmsTestClient.register(api, WEB_ORIGIN, mail, 'two@example.test');
    const id = await seedLayout(client, 'work');

    const listed = await client.get('/cms/design/layouts');
    expect(listed.body).toMatchObject({ data: { layouts: [{ id, section: 'work', name: 'work layout', source: 'ai' }] } });
    expect((await other.get('/cms/design/layouts')).body).toMatchObject({ data: { layouts: [] } });

    expect((await saveDesign(client, 0, { about: `custom:${id}` })).status).toBe(400);
    expect((await saveDesign(other, 0, { work: `custom:${id}` })).status).toBe(400);
    const saved = await saveDesign(client, 0, { work: `custom:${id}` });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ data: { design: { revision: 1, layout: { work: `custom:${id}` } } } });
  });

  it('design-library.IT02 / AC5 — a layout in use is refused; once free it is deleted', async () => {
    const client = await CmsTestClient.register(api, WEB_ORIGIN, mail, 'three@example.test');
    const id = await seedLayout(client, 'about');
    await saveDesign(client, 0, { about: `custom:${id}` });
    const preset = await client.send('post', '/cms/design/presets', { name: 'Uses it' });
    expect(preset.status).toBe(201);

    const refused = await client.send('delete', `/cms/design/layouts/${id}`);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ data: { code: 'LAYOUT_IN_USE', usedBy: ['draft', 'preset'] } });

    await saveDesign(client, 1, {});
    await client.send('delete', `/cms/design/presets/${(preset.body as { data: { preset: { id: string } } }).data.preset.id}`);
    expect((await client.send('delete', `/cms/design/layouts/${id}`)).body).toMatchObject({ data: { deleted: true } });
    expect((await client.send('delete', `/cms/design/layouts/${id}`)).status).toBe(404);
  });

  it('design-library.IT03 / AC6 — save, list, apply (current and stale revision), delete a preset', async () => {
    const client = await CmsTestClient.register(api, WEB_ORIGIN, mail, 'four@example.test');
    await saveDesign(client, 0, { hero: 'centered' });
    const saved = await client.send('post', '/cms/design/presets', { name: '  Centred <b>hero</b>  ' });
    expect(saved.status).toBe(201);
    const preset = (saved.body as { data: { preset: { id: string; name: string } } }).data.preset;
    expect(preset.name).toBe('Centred hero');
    expect((await client.get('/cms/design/presets')).body).toMatchObject({ data: { presets: [{ id: preset.id, design: { layout: { hero: 'centered' } } }] } });

    await saveDesign(client, 1, {});
    expect((await client.send('post', `/cms/design/presets/${preset.id}/apply`, { expectedRevision: 1 })).body).toMatchObject({
      data: { code: 'REVISION_CONFLICT', currentRevision: 2 },
    });
    const applied = await client.send('post', `/cms/design/presets/${preset.id}/apply`, { expectedRevision: 2 });
    expect(applied.body).toMatchObject({ data: { design: { revision: 3, layout: { hero: 'centered' } } } });
    expect((await client.send('delete', `/cms/design/presets/${preset.id}`)).body).toMatchObject({ data: { deleted: true } });
    expect((await client.send('delete', `/cms/design/presets/${preset.id}`)).status).toBe(404);
  });

  it('validates input, requires a session and the Origin', async () => {
    const client = await CmsTestClient.register(api, WEB_ORIGIN, mail, 'five@example.test');
    expect((await client.send('post', '/cms/design/presets', { name: '' })).status).toBe(400);
    expect((await client.send('delete', '/cms/design/layouts/not-an-id')).status).toBe(400);
    expect((await request(api.handler).get('/api/v1/cms/design/presets')).status).toBe(401);
    expect((await request(api.handler).post('/api/v1/cms/design/presets').set('Cookie', client.cookie).send({ name: 'x' })).status).toBe(403);
  });
});
