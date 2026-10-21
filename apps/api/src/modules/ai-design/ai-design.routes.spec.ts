/**
 * `ai-design-studio.API01`–`API06` end to end (`ai-design-studio.T09`; IT01–IT09, IT11–IT15)
 * against real MongoDB and Redis, the real container and the real background runner. The
 * generator is the stub, a scripted or held test generator, or — for IT15 — each real adapter
 * built by the factory from its environment row, against a loopback server.
 */
import { DEFAULT_DESIGN } from '@portfolio/design-tokens';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createApp, type ApiApplication } from '../../app.js';
import { loadEnv } from '../../config/env.js';
import { buildContainer, type Container } from '../../container.js';
import {
  CmsTestClient,
  geminiInteractionReply,
  ManualClock,
  MongoTestHarness,
  ollamaChatReply,
  openRouterCompletionReply,
  RecordedProviderServer,
  RecordingLogger,
  RecordingMailSender,
  RedisTestHarness,
  ScriptedDesignGenerator,
} from '../../testing/index.js';
import type { ActiveDesignGenerator, GenerationRequest, GenerationResult } from './index.js';
import { proposalModel } from './proposal.model.js';

const WEB_ORIGIN = 'http://127.0.0.1:3100';
const OWNER_SECRET = 'ai-design-routes-owner-secret-0000000000';
let mongo: MongoTestHarness;
let redis: RedisTestHarness;
let provider: RecordedProviderServer;

/** A valid answer that differs from the default in both parts. */
const proposed = {
  theme: { ...DEFAULT_DESIGN.theme, colors: { ...DEFAULT_DESIGN.theme.colors, accent: '#7dd3fc' } },
  layout: { hero: 'centered', about: 'stacked', work: 'list', experience: 'cards', stack: 'columns', contact: 'minimal' },
  rationale: 'Cooler accent, calmer layouts.',
};
const VALID = JSON.stringify(proposed);
const LOW_CONTRAST = JSON.stringify({ ...proposed, theme: { ...proposed.theme, colors: { ...proposed.theme.colors, text: '#1a1a1c' } } });
const PROSE = 'A calm design with a blue accent.';

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
  redis = await RedisTestHarness.start();
  provider = await RecordedProviderServer.start();
  await proposalModel(mongo.connection.getConnection()).init();
});
afterEach(async () => {
  await mongo.reset();
  await redis.reset();
  provider.reset();
});
afterAll(async () => {
  await mongo.stop();
  await redis.stop();
  await provider.stop();
});

/** Answers only once released, so a test can look at the pending state. */
class HeldDesignGenerator {
  readonly requests: GenerationRequest[] = [];
  private gates: (() => void)[] = [];

  constructor(private readonly answer = VALID) {}

  active(): ActiveDesignGenerator {
    const generator = {
      providerId: 'ollama' as const,
      generate: async (generation: GenerationRequest): Promise<GenerationResult> => {
        this.requests.push(generation);
        await new Promise<void>((resolve) => this.gates.push(resolve));
        return { text: this.answer };
      },
    };
    return { generator, health: { check: () => Promise.resolve({ reachable: true }) }, model: 'held-model' };
  }

  release(): void {
    for (const open of this.gates.splice(0)) open();
  }
}

interface Setup {
  readonly api: ApiApplication;
  readonly container: Container;
  readonly mail: RecordingMailSender;
  readonly logger: RecordingLogger;
}

function setup(options: { generator?: ActiveDesignGenerator; env?: Record<string, string>; clock?: ManualClock } = {}): Setup {
  const mail = new RecordingMailSender();
  const logger = new RecordingLogger();
  const container = buildContainer({
    env: loadEnv({
      NODE_ENV: 'test',
      PORT: '4100',
      MONGODB_URI: mongo.uri,
      REDIS_URL: redis.url,
      JWT_ACCESS_SECRET: 'ai-design-routes-placeholder-secret-0000',
      WEB_ORIGIN,
      OWNER_REGISTRATION_SECRET: OWNER_SECRET,
      ...options.env,
    }),
    logger,
    mongo: mongo.connection,
    redis: redis.connection,
    mailSender: mail,
    ...(options.clock ? { clock: options.clock } : {}),
    ...(options.generator ? { designGenerator: options.generator } : {}),
  });
  return { api: createApp(container), container, mail, logger };
}

/** Registers the platform owner with the owner secret. */
async function registerOwner({ api, mail }: Setup): Promise<CmsTestClient> {
  const registered = await request(api.handler)
    .post('/api/v1/auth/register')
    .set('Origin', WEB_ORIGIN)
    .send({ email: 'owner@example.test', password: 'a cms test client password', displayName: 'Owner', ownerSecret: OWNER_SECRET });
  const code = /\b(\d{6})\b/.exec(mail.last?.text ?? '')?.[1] ?? '';
  await request(api.handler)
    .post('/api/v1/auth/register/verify')
    .set('Origin', WEB_ORIGIN)
    .send({ reference: (registered.body as { data: { reference: string } }).data.reference, otp: code });
  return CmsTestClient.signIn(api, WEB_ORIGIN, { email: 'owner@example.test', password: 'a cms test client password' });
}

const member = ({ api, mail }: Setup, email = 'member@example.test') => CmsTestClient.register(api, WEB_ORIGIN, mail, email);

interface ProposalBody {
  data: { proposal: { id: string; status: string; provider: string; model: string; design: unknown; failure: { code: string } | null } };
}

const start = (client: CmsTestClient, body: object = { prompt: 'Cool and calm', scope: 'both' }) =>
  client.send('post', '/cms/ai/design-proposals', body);

/** Polls API02 until the proposal is no longer pending. */
async function settled(client: CmsTestClient, id: string): Promise<ProposalBody['data']['proposal']> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const proposal = ((await client.get(`/cms/ai/design-proposals/${id}`)).body as ProposalBody).data.proposal;
    if (proposal.status !== 'pending') return proposal;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('the proposal stayed pending');
}

async function generate(client: CmsTestClient, body?: object): Promise<ProposalBody['data']['proposal']> {
  const created = await start(client, body);
  expect(created.status).toBe(202);
  return settled(client, (created.body as ProposalBody).data.proposal.id);
}

describe('ai-design routes', () => {
  it('ai-design-studio.IT01 / AC1, AC2, AC11 — with the stub: 202 pending, then ready with a valid design', async () => {
    const app = setup();
    const client = await member(app);
    const created = await start(client);
    expect(created.status).toBe(202);
    expect(created.body).toMatchObject({ success: true, data: { proposal: { status: 'pending', provider: 'stub', model: 'fixture' } } });
    const ready = await settled(client, (created.body as ProposalBody).data.proposal.id);
    expect(ready).toMatchObject({ status: 'ready', provider: 'stub', failure: null });
    expect(ready.design).toMatchObject({ layout: { hero: 'centered' } });
  });

  it('ai-design-studio.IT02 / AC1 — the 202 returns before the generator answers', async () => {
    const held = new HeldDesignGenerator();
    const app = setup({ generator: held.active() });
    const client = await member(app);
    const created = await start(client);
    expect(created.status).toBe(202);
    // The generator has been called (or soon will be) but has not answered.
    const id = (created.body as ProposalBody).data.proposal.id;
    expect(((await client.get(`/cms/ai/design-proposals/${id}`)).body as ProposalBody).data.proposal.status).toBe('pending');
    held.release();
    await expect(settled(client, id)).resolves.toMatchObject({ status: 'ready', model: 'held-model' });
  });

  it('ai-design-studio.IT03 / AC3 — prose twice is INVALID_OUTPUT with no design', async () => {
    const app = setup({ generator: new ScriptedDesignGenerator([PROSE, PROSE]).active() });
    await expect(generate(await member(app))).resolves.toMatchObject({ status: 'failed', design: null, failure: { code: 'INVALID_OUTPUT' } });
  });

  it('ai-design-studio.IT04 / AC4 — low contrast then valid is ready after two calls', async () => {
    const scripted = new ScriptedDesignGenerator([LOW_CONTRAST, VALID]);
    const app = setup({ generator: scripted.active() });
    await expect(generate(await member(app))).resolves.toMatchObject({ status: 'ready' });
    expect(scripted.requests).toHaveLength(2);
  });

  it('ai-design-studio.IT05, IT14 / AC7 — while one is pending another is 409 with its id; of concurrent POSTs one is accepted', async () => {
    const held = new HeldDesignGenerator();
    const app = setup({ generator: held.active() });
    const client = await member(app);
    const responses = await Promise.all(Array.from({ length: 4 }, () => start(client)));
    const acceptedOnes = responses.filter((response) => response.status === 202);
    expect(acceptedOnes).toHaveLength(1);
    const id = (acceptedOnes[0]?.body as ProposalBody).data.proposal.id;
    for (const response of responses.filter((candidate) => candidate.status !== 202)) {
      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({ data: { code: 'GENERATION_IN_PROGRESS', proposalId: id } });
    }
    held.release();
    await settled(client, id);
  });

  it('ai-design-studio.IT06 / AC7, AC17 — past the free month a member gets 402 and nothing is stored; the owner does not; next month is free again', async () => {
    const clock = new ManualClock(new Date('2026-10-21T10:00:00.000Z'));
    const app = setup({ clock });
    const client = await member(app);
    for (let index = 0; index < 5; index += 1) await generate(client);

    const refused = await start(client);
    expect(refused.status).toBe(402);
    expect(refused.body).toMatchObject({ data: { code: 'CREDITS_REQUIRED', creditsRequired: 1, balance: 0 } });
    expect(((await client.get('/cms/ai/design-proposals?limit=50')).body as { data: { proposals: unknown[] } }).data.proposals).toHaveLength(5);
    expect((await client.get('/cms/ai/provider')).body).toMatchObject({
      data: { provider: 'stub', isStub: true, reachable: true, allowance: { unlimited: false, freeMonthly: 5, freeUsed: 5, creditCost: 1, balance: 0, resetsAt: '2026-11-01T00:00:00.000Z' } },
    });

    const owner = await registerOwner(app);
    expect((await owner.get('/cms/ai/provider')).body).toMatchObject({ data: { allowance: { unlimited: true, balance: null } } });
    await expect(generate(owner)).resolves.toMatchObject({ status: 'ready' });

    clock.advance(11 * 24 * 3_600_000);
    // The session expired with the month; sign in again.
    const again = await CmsTestClient.signIn(app.api, WEB_ORIGIN, { email: 'member@example.test', password: 'a cms test client password' });
    await expect(generate(again)).resolves.toMatchObject({ status: 'ready' });
  });

  it('ai-design-studio.IT07 / AC8 — apply: design revision + 1, proposal applied, nothing published', async () => {
    const app = setup();
    const client = await member(app);
    const slug = await client.slug();
    const publicBefore = (await request(app.api.handler).get(`/api/v1/public/portfolios/${slug}`)).status;
    const ready = await generate(client);
    const applied = await client.send('post', `/cms/ai/design-proposals/${ready.id}/apply`, { expectedDesignRevision: 0 });
    expect(applied.status).toBe(200);
    expect(applied.body).toMatchObject({ data: { design: { revision: 1, layout: { hero: 'centered' } }, proposal: { status: 'applied' } } });
    expect((await client.get('/cms/design')).body).toMatchObject({ data: { design: { revision: 1, layout: { hero: 'centered' } } } });
    expect((await request(app.api.handler).get(`/api/v1/public/portfolios/${slug}`)).status).toBe(publicBefore);
  });

  it('ai-design-studio.IT08 / AC9 — apply a failed proposal is PROPOSAL_NOT_READY; a stale revision REVISION_CONFLICT', async () => {
    const app = setup({ generator: new ScriptedDesignGenerator([PROSE, PROSE, VALID]).active() });
    const client = await member(app);
    const failed = await generate(client);
    const notReady = await client.send('post', `/cms/ai/design-proposals/${failed.id}/apply`, { expectedDesignRevision: 0 });
    expect(notReady.status).toBe(409);
    expect(notReady.body).toMatchObject({ data: { code: 'PROPOSAL_NOT_READY', status: 'failed' } });

    const ready = await generate(client);
    const stale = await client.send('post', `/cms/ai/design-proposals/${ready.id}/apply`, { expectedDesignRevision: 4 });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ data: { code: 'REVISION_CONFLICT', currentRevision: 0 } });
    expect((await client.get('/cms/design')).body).toMatchObject({ data: { design: { revision: 0 } } });
  });

  it('ai-design-studio.IT09 / AC10 — a proposal pending at restart is INTERRUPTED after the startup hooks; a new one is accepted', async () => {
    const held = new HeldDesignGenerator();
    const before = setup({ generator: held.active() });
    const client = await member(before);
    const pending = (await start(client)).body as ProposalBody;
    // "Restart": a new container over the same database runs its hooks before serving.
    const after = setup();
    for (const hook of after.container.startupHooks) await hook.run();
    const restarted = await CmsTestClient.signIn(after.api, WEB_ORIGIN, { email: 'member@example.test', password: 'a cms test client password' });
    expect(((await restarted.get(`/cms/ai/design-proposals/${pending.data.proposal.id}`)).body as ProposalBody).data.proposal).toMatchObject({
      status: 'failed',
      failure: { code: 'INTERRUPTED' },
    });
    expect((await start(restarted)).status).toBe(202);
    held.release();
  });

  it('ai-design-studio.IT11 / AC15 — the provider gets no name, email or section text; the logs no prompt', async () => {
    const scripted = new ScriptedDesignGenerator([VALID]);
    const app = setup({ generator: scripted.active() });
    const client = await member(app, 'private.person@example.test');
    const sectionText = 'Ada Lovelace Private builds analytical engines';
    await client.editSection('hero', (data) => {
      (data.intro as { body: string }).body = sectionText;
    });
    // The text really is in the draft, so its absence below means something.
    expect(JSON.stringify((await client.get('/cms/portfolio')).body)).toContain(sectionText);
    const prompt = 'A secret prompt about warm editorial tones';
    await generate(client, { prompt, scope: 'both' });
    const sent = JSON.stringify(scripted.requests);
    expect(sent).toContain(prompt);
    for (const value of ['private.person@example.test', sectionText, 'Test User']) expect(sent).not.toContain(value);
    expect(JSON.stringify(app.logger.entries)).not.toContain(prompt);
  });

  it('ai-design-studio.IT12 — discard: a pending one is 409; a ready one is 200 and leaves the list', async () => {
    const held = new HeldDesignGenerator();
    const app = setup({ generator: held.active() });
    const client = await member(app);
    const id = ((await start(client)).body as ProposalBody).data.proposal.id;
    const refused = await client.send('delete', `/cms/ai/design-proposals/${id}`);
    expect(refused.status).toBe(409);
    expect(refused.body).toMatchObject({ data: { code: 'PROPOSAL_NOT_READY', status: 'pending' } });
    held.release();
    await settled(client, id);
    expect((await client.send('delete', `/cms/ai/design-proposals/${id}`)).body).toMatchObject({ data: { proposal: { status: 'discarded' } } });
    expect((await client.get('/cms/ai/design-proposals')).body).toMatchObject({ data: { proposals: [], nextCursor: null } });
  });

  it('ai-design-studio.IT13 — every route without a session is 401', async () => {
    const { api } = setup();
    const id = '0123456789abcdef01234567';
    const calls = [
      request(api.handler).post('/api/v1/cms/ai/design-proposals').set('Origin', WEB_ORIGIN).send({ prompt: 'x', scope: 'both' }),
      request(api.handler).get('/api/v1/cms/ai/design-proposals'),
      request(api.handler).get(`/api/v1/cms/ai/design-proposals/${id}`),
      request(api.handler).post(`/api/v1/cms/ai/design-proposals/${id}/apply`).set('Origin', WEB_ORIGIN).send({ expectedDesignRevision: 0 }),
      request(api.handler).delete(`/api/v1/cms/ai/design-proposals/${id}`).set('Origin', WEB_ORIGIN),
      request(api.handler).get('/api/v1/cms/ai/provider'),
    ];
    for (const response of await Promise.all(calls)) expect(response.status).toBe(401);
  });

  it('validates input, requires the Origin, and isolates portfolios', async () => {
    const app = setup();
    const client = await member(app);
    expect((await start(client, { prompt: 'x'.repeat(601), scope: 'both' })).status).toBe(400);
    expect((await start(client, { prompt: 'Calm', scope: 'colours' })).status).toBe(400);
    expect((await start(client, { prompt: '<b></b>', scope: 'both' })).status).toBe(400);
    expect((await client.get('/cms/ai/design-proposals?limit=51')).status).toBe(400);
    expect((await client.get('/cms/ai/design-proposals/not-an-id')).status).toBe(400);
    const noOrigin = await request(app.api.handler).post('/api/v1/cms/ai/design-proposals').set('Cookie', client.cookie).send({ prompt: 'Calm', scope: 'both' });
    expect(noOrigin.status).toBe(403);

    const mine = await generate(client);
    const other = await member(app, 'other@example.test');
    expect((await other.get(`/cms/ai/design-proposals/${mine.id}`)).status).toBe(404);
    expect((await other.send('post', `/cms/ai/design-proposals/${mine.id}/apply`, { expectedDesignRevision: 0 })).status).toBe(404);
    expect((await other.send('delete', `/cms/ai/design-proposals/${mine.id}`)).status).toBe(404);
    expect((await other.get('/cms/ai/design-proposals')).body).toMatchObject({ data: { proposals: [] } });
  });

  it('the AI rate limit answers 429 with Retry-After past 10 generation requests', async () => {
    const app = setup({ generator: new ScriptedDesignGenerator([PROSE, PROSE]).active() });
    const client = await member(app);
    const statuses: number[] = [];
    for (let index = 0; index < 11; index += 1) statuses.push((await start(client, { prompt: 'x'.repeat(601), scope: 'both' })).status);
    expect(statuses.slice(0, 10).every((status) => status === 400)).toBe(true);
    const limited = await start(client);
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ data: { code: 'RATE_LIMITED' } });
    expect(limited.headers['retry-after']).toBeDefined();
  });

  describe('ai-design-studio.IT15 / AC14 — each provider, chosen by its environment row alone', () => {
    const rows: readonly { provider: string; env: () => Record<string, string>; reply: (text: string) => unknown }[] = [
      { provider: 'ollama', env: () => ({ AI_PROVIDER: 'ollama', OLLAMA_BASE_URL: provider.url, AI_MODEL: 'local-model' }), reply: ollamaChatReply },
      { provider: 'gemini', env: () => ({ AI_PROVIDER: 'gemini', GEMINI_BASE_URL: provider.url, GEMINI_API_KEY: 'gemini-test-key', AI_MODEL: 'gemini-model' }), reply: geminiInteractionReply },
      {
        provider: 'openrouter',
        env: () => ({ AI_PROVIDER: 'openrouter', OPENROUTER_BASE_URL: provider.url, OPENROUTER_API_KEY: 'router-test-key', AI_MODEL: 'router-model' }),
        reply: openRouterCompletionReply,
      },
    ];

    it.each(rows)('$provider: create → ready, recording the provider and the model', async (row) => {
      const environment = row.env();
      provider.reply({ body: row.reply(VALID) });
      const app = setup({ env: environment });
      const client = await member(app);
      await expect(generate(client)).resolves.toMatchObject({ status: 'ready', provider: row.provider, model: environment.AI_MODEL });
      expect(provider.requests).toHaveLength(1);
      provider.reply({ status: 200, body: {} });
      expect((await client.get('/cms/ai/provider')).body).toMatchObject({ data: { provider: row.provider, model: environment.AI_MODEL, isStub: false, reachable: true } });
    });
  });
});
