/**
 * `MonthlyGenerationAllowance` (`ai-design-studio.T04`; UT15, UT16; AC7, AC17) with fakes only.
 */
import { Types } from 'mongoose';
import { describe, expect, it } from 'vitest';

import {
  InMemoryProposalRepository,
  ManualClock,
  MapRoleReader,
  RecordingWallet,
} from '../../testing/index.js';
import { DefaultAiPricing } from './adapters/default-ai-pricing.js';
import { EmptyGenerationWallet } from './adapters/empty-generation-wallet.js';
import type { IGenerationWallet } from './ai-design.interface.js';
import type { NewProposal, ProposalFailureCode, StoredProposal } from './ai-design.types.js';
import { MonthlyGenerationAllowance } from './generation-allowance.service.js';

const OWNER = new Types.ObjectId().toString();
const MEMBER = new Types.ObjectId().toString();
const portfolioId = new Types.ObjectId().toString();
const member = { userId: MEMBER, portfolioId };
const owner = { userId: OWNER, portfolioId };

function setup(wallet: IGenerationWallet = new RecordingWallet(), now = new Date('2026-10-21T10:00:00.000Z')) {
  const proposals = new InMemoryProposalRepository();
  const clock = new ManualClock(now);
  const allowance = new MonthlyGenerationAllowance(
    proposals,
    new DefaultAiPricing({ freeMonthly: 2, creditCost: 3 }),
    wallet,
    new MapRoleReader({ [OWNER]: 'owner', [MEMBER]: 'member' }),
    clock,
  );
  const store = async (charge: NewProposal['charge'], createdAt = clock.now(), userId = MEMBER) => {
    const row = await proposals.insertPending({
      portfolioId,
      userId,
      prompt: 'x',
      scope: 'both',
      basedOnCurrent: true,
      provider: 'stub',
      model: 'fixture',
      charge,
      createdAt,
    });
    // Ended, so the next insert is not refused as in flight.
    await proposals.complete(portfolioId, row.id, { status: 'ready', design: {} as never, rationale: null, durationMs: 0, completedAt: createdAt });
    return row;
  };
  const fail = async (row: StoredProposal, code: ProposalFailureCode): Promise<StoredProposal> => {
    await proposals.transition(portfolioId, row.id, 'ready', 'failed');
    const stored = await proposals.findById(portfolioId, row.id);
    if (stored === null) throw new Error('the proposal was just stored');
    return { ...stored, status: 'failed', failure: { code, message: 'x' } };
  };
  return { proposals, clock, allowance, store, fail };
}

describe('MonthlyGenerationAllowance', () => {
  describe('ai-design-studio.UT15 / AC17', () => {
    it('the owner is unlimited: charge none, balance null, however many this month', async () => {
      const { allowance, store } = setup();
      for (let index = 0; index < 4; index += 1) await store({ kind: 'none', credits: 0 }, undefined, OWNER);
      await expect(allowance.quote(owner)).resolves.toEqual({
        allowance: { unlimited: true, freeMonthly: 2, freeUsed: 0, creditCost: 3, balance: null, resetsAt: '2026-11-01T00:00:00.000Z' },
        next: { kind: 'none', credits: 0 },
      });
    });

    it('a member within the free count gets a free slot', async () => {
      const { allowance, store } = setup();
      await store({ kind: 'free', credits: 0 });
      await expect(allowance.quote(member)).resolves.toMatchObject({
        allowance: { unlimited: false, freeUsed: 1, balance: 0 },
        next: { kind: 'free', credits: 0 },
      });
    });

    it('past the free count: credits when the balance covers them, refused when it does not', async () => {
      const rich = setup(new RecordingWallet({ [MEMBER]: 3 }));
      await rich.store({ kind: 'free', credits: 0 });
      await rich.store({ kind: 'free', credits: 0 });
      await expect(rich.allowance.quote(member)).resolves.toMatchObject({ allowance: { freeUsed: 2, balance: 3 }, next: { kind: 'credit', credits: 3 } });

      const poor = setup(new RecordingWallet({ [MEMBER]: 2 }));
      await poor.store({ kind: 'free', credits: 0 });
      await poor.store({ kind: 'free', credits: 0 });
      await expect(poor.allowance.quote(member)).resolves.toMatchObject({ allowance: { balance: 2 }, next: null });
    });

    it('with the empty wallet, a member past the free count is refused', async () => {
      const { allowance, store } = setup(new EmptyGenerationWallet());
      await store({ kind: 'free', credits: 0 });
      await store({ kind: 'free', credits: 0 });
      await expect(allowance.quote(member)).resolves.toMatchObject({ next: null });
    });

    it('last month does not count; the allowance resets at 00:00 UTC on the first', async () => {
      const { allowance, store, clock } = setup(undefined, new Date('2026-10-31T23:59:00.000Z'));
      await store({ kind: 'free', credits: 0 });
      await store({ kind: 'free', credits: 0 });
      await expect(allowance.quote(member)).resolves.toMatchObject({ next: null });
      clock.advance(60_000);
      await expect(allowance.quote(member)).resolves.toMatchObject({
        allowance: { freeUsed: 0, resetsAt: '2026-12-01T00:00:00.000Z' },
        next: { kind: 'free' },
      });
    });

    it('an unknown user is treated as a member, never as the owner', async () => {
      const { allowance } = setup();
      await expect(allowance.quote({ userId: new Types.ObjectId().toString(), portfolioId })).resolves.toMatchObject({
        allowance: { unlimited: false },
      });
    });

    it('platform-fault failures stop counting once refunded', async () => {
      const { allowance, store, fail } = setup();
      await store({ kind: 'free', credits: 0 });
      const second = await store({ kind: 'free', credits: 0 });
      await allowance.refund(await fail(second, 'PROVIDER_ERROR'));
      await expect(allowance.quote(member)).resolves.toMatchObject({ allowance: { freeUsed: 1 }, next: { kind: 'free' } });
    });
  });

  describe('settle', () => {
    it('spends credits for a credit charge only, referencing the proposal', async () => {
      const wallet = new RecordingWallet({ [MEMBER]: 5 });
      const { allowance } = setup(wallet);
      await expect(allowance.settle(member, 'p1', { kind: 'free', credits: 0 })).resolves.toBe(true);
      await expect(allowance.settle(member, 'p2', { kind: 'credit', credits: 3 })).resolves.toBe(true);
      expect(wallet.spends).toEqual([{ userId: MEMBER, credits: 3, reference: 'p2' }]);
      await expect(allowance.settle(member, 'p3', { kind: 'credit', credits: 3 })).resolves.toBe(false);
    });
  });

  describe('ai-design-studio.UT16 / AC17 — refunds', () => {
    it('a credit-charged PROVIDER_ERROR is refunded once', async () => {
      const wallet = new RecordingWallet({ [MEMBER]: 3 });
      const { allowance, store, fail } = setup(wallet);
      const row = await store({ kind: 'credit', credits: 3 });
      const failed = await fail(row, 'PROVIDER_ERROR');
      await allowance.refund(failed);
      await allowance.refund(failed);
      expect(wallet.refunds).toEqual([{ userId: MEMBER, credits: 3, reference: row.id }]);
    });

    it.each(['PROVIDER_TIMEOUT', 'INTERRUPTED'] as const)('%s is refunded too', async (code) => {
      const wallet = new RecordingWallet();
      const { allowance, store, fail } = setup(wallet);
      await allowance.refund(await fail(await store({ kind: 'credit', credits: 3 }), code));
      expect(wallet.refunds).toHaveLength(1);
    });

    it.each(['INVALID_OUTPUT', 'CONTRAST_FAILED'] as const)('%s is not refunded: the provider answered', async (code) => {
      const wallet = new RecordingWallet();
      const { allowance, store, fail, proposals } = setup(wallet);
      const row = await store({ kind: 'credit', credits: 3 });
      await allowance.refund(await fail(row, code));
      expect(wallet.refunds).toEqual([]);
      expect((await proposals.findById(portfolioId, row.id))?.charge.refunded).toBe(false);
    });

    it('a ready proposal and an owner proposal give nothing back', async () => {
      const wallet = new RecordingWallet();
      const { allowance, store, fail } = setup(wallet);
      await allowance.refund(await store({ kind: 'credit', credits: 3 }));
      await allowance.refund(await fail(await store({ kind: 'none', credits: 0 }, undefined, OWNER), 'PROVIDER_ERROR'));
      expect(wallet.refunds).toEqual([]);
    });
  });

  it('the empty wallet holds nothing and gives nothing', async () => {
    const wallet = new EmptyGenerationWallet();
    await expect(wallet.balance()).resolves.toBe(0);
    await expect(wallet.spend()).resolves.toBe(false);
    await expect(wallet.refund()).resolves.toBeUndefined();
  });
});
