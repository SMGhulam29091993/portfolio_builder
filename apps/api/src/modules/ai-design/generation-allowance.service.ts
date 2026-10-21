/**
 * `MonthlyGenerationAllowance` (`ai-design-studio.T04`; AC7, AC17, AC18): who may generate, at
 * what charge.
 *
 * - The owner is unlimited: no allowance or credit applies (charge `none`).
 * - A member has `freeMonthly` free generations per calendar month (UTC), counted from the
 *   month's stored, unrefunded free proposals; past them each costs `creditCost` credits,
 *   taken through `IGenerationWallet` once the proposal is stored; too few credits → refused.
 * - A proposal ending `PROVIDER_TIMEOUT`, `PROVIDER_ERROR` or `INTERRUPTED` gives back what it
 *   used — the free slot stops counting, credits are refunded — exactly once.
 */
import type { IClock } from '../auth/index.js';
import type {
  IAiPricing,
  IGenerationAllowance,
  IGenerationWallet,
  IProposalRepository,
  IUserRoleReader,
} from './ai-design.interface.js';
import {
  REFUNDABLE_FAILURES,
  type AllowanceQuote,
  type AllowanceSubject,
  type ProposalCharge,
  type StoredProposal,
} from './ai-design.types.js';

export class MonthlyGenerationAllowance implements IGenerationAllowance {
  constructor(
    private readonly proposals: IProposalRepository,
    private readonly pricing: IAiPricing,
    private readonly wallet: IGenerationWallet,
    private readonly roles: IUserRoleReader,
    private readonly clock: IClock,
  ) {}

  async quote(subject: AllowanceSubject): Promise<AllowanceQuote> {
    const now = this.clock.now();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const resetsAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString();
    const [{ freeMonthly, creditCost }, freeUsed, role] = await Promise.all([
      this.pricing.current(),
      this.proposals.countFreeSince(subject.portfolioId, monthStart),
      this.roles.roleOf(subject.userId),
    ]);

    if (role === 'owner') {
      return {
        allowance: { unlimited: true, freeMonthly, freeUsed, creditCost, balance: null, resetsAt },
        next: { kind: 'none', credits: 0 },
      };
    }
    const balance = await this.wallet.balance(subject.userId);
    const allowance = { unlimited: false, freeMonthly, freeUsed, creditCost, balance, resetsAt };
    if (freeUsed < freeMonthly) return { allowance, next: { kind: 'free', credits: 0 } };
    return { allowance, next: balance >= creditCost ? { kind: 'credit', credits: creditCost } : null };
  }

  async settle(subject: AllowanceSubject, proposalId: string, charge: Omit<ProposalCharge, 'refunded'>): Promise<boolean> {
    if (charge.kind !== 'credit') return true;
    return this.wallet.spend(subject.userId, charge.credits, proposalId);
  }

  async refund(proposal: StoredProposal): Promise<void> {
    if (proposal.failure === null || !REFUNDABLE_FAILURES.includes(proposal.failure.code)) return;
    // The flag flips once; only the call that flipped it gives credits back (UT16: refunded once).
    const flipped = await this.proposals.markRefunded(proposal.portfolioId, proposal.id);
    if (flipped && proposal.charge.kind === 'credit') {
      await this.wallet.refund(proposal.userId, proposal.charge.credits, proposal.id);
    }
  }
}
