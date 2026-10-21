/**
 * `AiDesignService` (`ai-design-studio.T04`; UT07, UT08, UT11–UT13, UT16; AC1–AC10, AC17) with
 * fakes of every port. The prompt builder and parser are the real classes: they are pure, and
 * the repair loop is only meaningful against the real verdicts.
 */
import { CONTRAST_PAIRS, DEFAULT_DESIGN, FONT_ALLOW_LIST, VARIANT_CATALOGUE } from '@portfolio/design-tokens';
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import { UpstreamError } from '../../core/errors/index.js';
import {
  InMemoryDesignStore,
  InMemoryProposalRepository,
  ManualBackgroundRunner,
  ManualClock,
  MapRoleReader,
  RecordingLogger,
  RecordingWallet,
  ScriptedDesignGenerator,
  StaticSectionLister,
  TokensDesignValidator,
  type ScriptedAnswer,
} from '../../testing/index.js';
import { DefaultAiPricing } from './adapters/default-ai-pricing.js';
import { ProviderTimeoutError } from './ai-design.errors.js';
import { AiDesignService } from './ai-design.service.js';
import type { CreateProposalRequest } from './ai-design.types.js';
import { DesignPromptBuilder } from './design-prompt.builder.js';
import { DesignSpecParser } from './design-spec.parser.js';
import { MonthlyGenerationAllowance } from './generation-allowance.service.js';
import { InterruptedProposalRecovery } from './interrupted-proposal.recovery.js';

const OWNER = new Types.ObjectId().toString();
const MEMBER = new Types.ObjectId().toString();
const portfolioId = new Types.ObjectId().toString();
const otherPortfolioId = new Types.ObjectId().toString();
const member = { userId: MEMBER, portfolioId };
const owner = { userId: OWNER, portfolioId };

/** A valid answer that differs from the default in both parts. */
const proposed = {
  theme: { ...DEFAULT_DESIGN.theme, colors: { ...DEFAULT_DESIGN.theme.colors, accent: '#7dd3fc' } },
  layout: { hero: 'centered', about: 'stacked', work: 'list', experience: 'cards', stack: 'columns', contact: 'minimal' },
  rationale: 'Cooler accent.',
};
const VALID = JSON.stringify(proposed);
const LOW_CONTRAST = JSON.stringify({ ...proposed, theme: { ...proposed.theme, colors: { ...proposed.theme.colors, text: '#1a1a1c' } } });
const PROSE = 'A calm design with a blue accent.';

const request: CreateProposalRequest = { prompt: 'Cool and calm', scope: 'both', basedOnCurrent: true };

function setup(answers: ScriptedAnswer[] = [VALID], options: { balance?: number; freeMonthly?: number } = {}) {
  const proposals = new InMemoryProposalRepository();
  const generator = new ScriptedDesignGenerator(answers);
  const designs = new InMemoryDesignStore();
  const runner = new ManualBackgroundRunner();
  const clock = new ManualClock(new Date('2026-10-21T10:00:00.000Z'));
  const logger = new RecordingLogger();
  const wallet = new RecordingWallet({ [MEMBER]: options.balance ?? 0 });
  const allowance = new MonthlyGenerationAllowance(
    proposals,
    new DefaultAiPricing({ freeMonthly: options.freeMonthly ?? 5, creditCost: 1 }),
    wallet,
    new MapRoleReader({ [OWNER]: 'owner', [MEMBER]: 'member' }),
    clock,
  );
  const service = new AiDesignService(
    proposals,
    generator.active(),
    new DesignPromptBuilder({ variants: VARIANT_CATALOGUE, fonts: FONT_ALLOW_LIST, contrastPairs: CONTRAST_PAIRS }),
    new DesignSpecParser(new TokensDesignValidator()),
    designs,
    designs,
    new StaticSectionLister(),
    allowance,
    runner,
    clock,
    logger,
  );
  /** Creates a proposal and runs it to the end. */
  const generate = async (subject = member, body = request) => {
    const created = await service.create(subject, body);
    await runner.runAll();
    return service.get(subject, created.id);
  };
  return { proposals, generator, designs, runner, clock, logger, wallet, service, generate };
}

describe('AiDesignService', () => {
  describe('create', () => {
    it('ai-design-studio.AC1 — stores a pending proposal and returns before the provider is asked', async () => {
      const { service, generator, runner } = setup();
      const created = await service.create(member, request);
      expect(created).toMatchObject({
        status: 'pending',
        prompt: request.prompt,
        scope: 'both',
        provider: 'ollama',
        model: 'scripted-model',
        design: null,
        charge: { kind: 'free', credits: 0, refunded: false },
        completedAt: null,
      });
      expect(created).not.toHaveProperty('userId');
      expect(generator.requests).toHaveLength(0);
      expect(runner.labels).toEqual([`design proposal ${created.id}`]);
    });

    it('ai-design-studio.UT11 / AC7 — a second while one is pending is GENERATION_IN_PROGRESS', async () => {
      const { service } = setup();
      const first = await service.create(member, request);
      await expect(service.create(member, request)).rejects.toMatchObject({
        status: 409,
        code: 'GENERATION_IN_PROGRESS',
        details: { proposalId: first.id },
      });
    });

    it('ai-design-studio.UT11 / AC7 — past the allowance with no credits is CREDITS_REQUIRED and stores nothing', async () => {
      const { service, proposals } = setup([VALID], { freeMonthly: 0 });
      await expect(service.create(member, request)).rejects.toMatchObject({
        status: 402,
        code: 'CREDITS_REQUIRED',
        details: { creditsRequired: 1, balance: 0 },
      });
      expect(proposals.all()).toEqual([]);
    });

    it('ai-design-studio.AC17 — past the allowance with credits spends them on the stored proposal', async () => {
      const { service, wallet } = setup([VALID], { freeMonthly: 0, balance: 2 });
      const created = await service.create(member, request);
      expect(created.charge).toEqual({ kind: 'credit', credits: 1, refunded: false });
      expect(wallet.spends).toEqual([{ userId: MEMBER, credits: 1, reference: created.id }]);
    });

    it('a spend that fails after the insert removes the proposal and is CREDITS_REQUIRED', async () => {
      const { service, wallet, proposals, runner } = setup([VALID], { freeMonthly: 0, balance: 2 });
      wallet.refuseNextSpend = true;
      await expect(service.create(member, request)).rejects.toMatchObject({ code: 'CREDITS_REQUIRED' });
      expect(proposals.all()).toEqual([]);
      expect(runner.labels).toEqual([]);
    });

    it('ai-design-studio.AC17 — the owner is never charged', async () => {
      const { service } = setup([VALID], { freeMonthly: 0 });
      await expect(service.create(owner, request)).resolves.toMatchObject({ charge: { kind: 'none', credits: 0 } });
    });
  });

  describe('run', () => {
    it('ai-design-studio.UT07 / AC2 — a valid answer makes the proposal ready with design, rationale, provider, model and duration', async () => {
      const { generate, generator, clock } = setup();
      generator.generate = ((original) => async (...args: Parameters<typeof original>) => {
        clock.advance(1_500);
        return original(...args);
      })(generator.generate.bind(generator));
      const ready = await generate();
      expect(ready).toMatchObject({
        status: 'ready',
        design: { theme: proposed.theme, layout: proposed.layout },
        rationale: proposed.rationale,
        provider: 'ollama',
        model: 'scripted-model',
        durationMs: 1_500,
        failure: null,
      });
      expect(ready.completedAt).toBe('2026-10-21T10:00:01.500Z');
    });

    it('sends the draft design, the visible sections and the prompt — and only the scoped part changes (AC5)', async () => {
      const { generate, generator } = setup([JSON.stringify({ ...proposed, layout: { ...proposed.layout, hero: 'carousel' } })]);
      const ready = await generate(member, { ...request, scope: 'theme' });
      expect(ready).toMatchObject({ status: 'ready', design: { theme: proposed.theme, layout: DEFAULT_DESIGN.layout } });
      const content = generator.requests[0]?.messages[0]?.content ?? '';
      expect(content).toContain(request.prompt);
      expect(content).toContain('hero, about, work');
      expect(content).toContain(JSON.stringify({ theme: DEFAULT_DESIGN.theme, layout: DEFAULT_DESIGN.layout }));
    });

    it('basedOnCurrent false starts fresh', async () => {
      const { generate, generator } = setup();
      await generate(member, { ...request, basedOnCurrent: false });
      expect(generator.requests[0]?.messages[0]?.content).toContain('Start fresh');
    });

    it('ai-design-studio.UT08 / AC3 — invalid then valid is ready after one repair, carrying the reasons', async () => {
      const { generate, generator } = setup([PROSE, VALID]);
      await expect(generate()).resolves.toMatchObject({ status: 'ready' });
      expect(generator.requests).toHaveLength(2);
      expect(generator.requests[1]?.messages).toHaveLength(3);
      expect(generator.requests[1]?.messages[2]?.content).toContain('The answer has no JSON object');
    });

    it('ai-design-studio.UT08 / AC3 — invalid twice is INVALID_OUTPUT after exactly two calls, with no design', async () => {
      const { generate, generator } = setup([PROSE, PROSE, VALID]);
      await expect(generate()).resolves.toMatchObject({ status: 'failed', design: null, failure: { code: 'INVALID_OUTPUT' } });
      expect(generator.requests).toHaveLength(2);
    });

    it('ai-design-studio.UT08 / AC4 — low contrast twice is CONTRAST_FAILED; the repair carries the ratios', async () => {
      const { generate, generator } = setup([LOW_CONTRAST, LOW_CONTRAST]);
      await expect(generate()).resolves.toMatchObject({ status: 'failed', failure: { code: 'CONTRAST_FAILED' } });
      expect(generator.requests[1]?.messages[2]?.content).toMatch(/\d+\.\d{2}:1/);
    });

    it('ai-design-studio.AC4 — low contrast then valid is ready', async () => {
      const { generate } = setup([LOW_CONTRAST, VALID]);
      await expect(generate()).resolves.toMatchObject({ status: 'ready' });
    });

    it('ai-design-studio.AC6 — a timeout is PROVIDER_TIMEOUT; another upstream failure PROVIDER_ERROR; neither is retried here', async () => {
      const timedOut = setup([new ProviderTimeoutError('ollama')]);
      await expect(timedOut.generate()).resolves.toMatchObject({ status: 'failed', failure: { code: 'PROVIDER_TIMEOUT' } });
      expect(timedOut.generator.requests).toHaveLength(1);
      const broken = setup([new UpstreamError('ollama')]);
      await expect(broken.generate()).resolves.toMatchObject({ status: 'failed', failure: { code: 'PROVIDER_ERROR' } });
      expect(broken.generator.requests).toHaveLength(1);
    });

    it('a crash is logged with the proposal id and recorded as PROVIDER_ERROR, never left pending', async () => {
      const { generate, logger } = setup([new TypeError('bug')]);
      const failed = await generate();
      expect(failed).toMatchObject({ status: 'failed', failure: { code: 'PROVIDER_ERROR' } });
      expect(logger.entries).toContainEqual(
        expect.objectContaining({ level: 'error', message: 'design proposal crashed', context: expect.objectContaining({ proposalId: failed.id }) as unknown }),
      );
    });

    it('ai-design-studio.AC15 — logs carry no prompt text', async () => {
      const { generate, logger } = setup([PROSE, PROSE]);
      await generate();
      expect(JSON.stringify(logger.entries)).not.toContain(request.prompt);
      expect(logger.entries.some((entry) => entry.message === 'design proposal completed')).toBe(true);
    });

    it('ai-design-studio.UT16 / AC17 — a credit-charged PROVIDER_ERROR is refunded once; INVALID_OUTPUT is not', async () => {
      const broken = setup([new UpstreamError('ollama')], { freeMonthly: 0, balance: 1 });
      const failed = await broken.generate();
      expect(failed.charge).toEqual({ kind: 'credit', credits: 1, refunded: true });
      expect(broken.wallet.refunds).toEqual([{ userId: MEMBER, credits: 1, reference: failed.id }]);

      const invalid = setup([PROSE, PROSE], { freeMonthly: 0, balance: 1 });
      expect((await invalid.generate()).charge.refunded).toBe(false);
      expect(invalid.wallet.refunds).toEqual([]);
    });

    it('a proposal no longer pending when the run ends is left as it is', async () => {
      const { service, runner, proposals } = setup();
      const created = await service.create(member, request);
      await proposals.complete(portfolioId, created.id, {
        status: 'failed',
        failure: { code: 'INTERRUPTED', message: 'x' },
        durationMs: 0,
        completedAt: new Date(),
      });
      await runner.runAll();
      await expect(service.get(member, created.id)).resolves.toMatchObject({ status: 'failed', failure: { code: 'INTERRUPTED' } });
    });
  });

  describe('read', () => {
    it('get is scoped to the portfolio', async () => {
      const { generate, service } = setup();
      const ready = await generate();
      await expect(service.get({ userId: MEMBER, portfolioId: otherPortfolioId }, ready.id)).rejects.toMatchObject({ status: 404 });
      await expect(service.get(member, new Types.ObjectId().toString())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it('lists newest first with a cursor while another page exists', async () => {
      const { generate, service, clock } = setup([VALID, VALID, VALID]);
      const ids: string[] = [];
      for (let index = 0; index < 3; index += 1) {
        ids.push((await generate()).id);
        clock.advance(1_000);
      }
      const first = await service.list(member, 2);
      expect(first.proposals.map((row) => row.id)).toEqual([ids[2], ids[1]]);
      expect(first.nextCursor).toBe(ids[1]);
      const second = await service.list(member, 2, first.nextCursor ?? undefined);
      expect(second).toMatchObject({ proposals: [{ id: ids[0] }], nextCursor: null });
    });
  });

  describe('ai-design-studio.UT12 / AC8, AC9 — apply', () => {
    it('a ready proposal with the matching revision replaces the draft design and becomes applied', async () => {
      const { generate, service, designs } = setup();
      const ready = await generate();
      const applied = await service.apply(member, ready.id, 0);
      expect(applied.design).toMatchObject({ revision: 1, theme: proposed.theme, layout: proposed.layout });
      expect(applied.proposal.status).toBe('applied');
      expect(designs.writes).toEqual([portfolioId]);
    });

    it.each(['pending', 'failed', 'applied', 'discarded'] as const)('a %s proposal is PROPOSAL_NOT_READY and writes nothing', async (status) => {
      const { service, runner, designs, proposals } = setup([PROSE, PROSE]);
      const created = await service.create(member, request);
      if (status !== 'pending') await runner.runAll();
      if (status === 'applied' || status === 'discarded') {
        // Force the status directly: the test is about apply refusing it.
        await proposals.transition(portfolioId, created.id, 'failed', status);
      }
      await expect(service.apply(member, created.id, 0)).rejects.toMatchObject({
        status: 409,
        code: 'PROPOSAL_NOT_READY',
        details: { status },
      });
      expect(designs.writes).toEqual([]);
    });

    it('a stale revision is REVISION_CONFLICT; the proposal stays ready and can be applied after', async () => {
      const { generate, service, designs } = setup();
      const ready = await generate();
      await expect(service.apply(member, ready.id, 3)).rejects.toMatchObject({ code: 'REVISION_CONFLICT', details: { currentRevision: 0 } });
      expect(designs.writes).toEqual([]);
      await expect(service.get(member, ready.id)).resolves.toMatchObject({ status: 'ready' });
      await expect(service.apply(member, ready.id, 0)).resolves.toMatchObject({ proposal: { status: 'applied' } });
    });

    it('another portfolio’s proposal is NOT_FOUND', async () => {
      const { generate, service } = setup();
      const ready = await generate();
      await expect(service.apply({ userId: MEMBER, portfolioId: otherPortfolioId }, ready.id, 0)).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('discard', () => {
    it('ready and failed proposals are discarded and leave the list', async () => {
      const { generate, service } = setup([VALID, PROSE, PROSE]);
      const ready = await generate();
      const failed = await generate();
      await expect(service.discard(member, ready.id)).resolves.toMatchObject({ status: 'discarded' });
      await expect(service.discard(member, failed.id)).resolves.toMatchObject({ status: 'discarded' });
      await expect(service.list(member, 10)).resolves.toEqual({ proposals: [], nextCursor: null });
    });

    it('pending and applied proposals are PROPOSAL_NOT_READY', async () => {
      const { service, runner } = setup();
      const created = await service.create(member, request);
      await expect(service.discard(member, created.id)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_READY', details: { status: 'pending' } });
      await runner.runAll();
      await service.apply(member, created.id, 0);
      await expect(service.discard(member, created.id)).rejects.toMatchObject({ code: 'PROPOSAL_NOT_READY', details: { status: 'applied' } });
    });
  });

  it('ai-design-studio.API06 — reports provider, model, stub flag, reachability and the allowance', async () => {
    const { service, generator } = setup();
    generator.reachable = false;
    await expect(service.provider(member)).resolves.toEqual({
      provider: 'ollama',
      model: 'scripted-model',
      isStub: false,
      reachable: false,
      allowance: { unlimited: false, freeMonthly: 5, freeUsed: 0, creditCost: 1, balance: 0, resetsAt: '2026-11-01T00:00:00.000Z' },
    });
  });

  describe('ai-design-studio.UT13 / AC10 — recovery', () => {
    it('fails every pending proposal with INTERRUPTED, refunds them, and a new one can start', async () => {
      const { service, proposals, logger } = setup([VALID], { freeMonthly: 0, balance: 5 });
      const first = await service.create(member, request);
      const second = await service.create({ userId: OWNER, portfolioId: otherPortfolioId }, request);
      // The runner never ran: the process "restarted".
      await new InterruptedProposalRecovery(service).run();
      for (const [subject, id] of [[member, first.id], [{ userId: OWNER, portfolioId: otherPortfolioId }, second.id]] as const) {
        await expect(service.get(subject, id)).resolves.toMatchObject({ status: 'failed', failure: { code: 'INTERRUPTED' } });
      }
      expect((await proposals.findById(portfolioId, first.id))?.charge.refunded).toBe(true);
      expect(logger.entries).toContainEqual(expect.objectContaining({ message: 'interrupted design proposals failed', context: { count: 2 } }));
      await expect(service.create(member, request)).resolves.toMatchObject({ status: 'pending' });
      await expect(service.recoverInterrupted()).resolves.toBe(1);
    });

    it('with nothing pending it does nothing and logs nothing', async () => {
      const { service, logger } = setup();
      await expect(service.recoverInterrupted()).resolves.toBe(0);
      expect(logger.entries).toEqual([]);
    });
  });
});
