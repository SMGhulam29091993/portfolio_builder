/**
 * `InMemoryProposalRepository` — the `IProposalRepository` fake `AiDesignService` and
 * `MonthlyGenerationAllowance` are tested with. It passes the same contract suite as the real
 * repository (`ai-design-studio.CT04`, `proposal-repository.contract.spec.ts`), so the two are
 * interchangeable (`constitution.md` → Liskov Substitution).
 */
import { Types } from 'mongoose';

import { ConflictError } from '../../core/errors/index.js';
import type {
  IProposalRepository,
  NewProposal,
  ProposalOutcome,
  StoredProposal,
} from '../../modules/ai-design/index.js';
import type { ProposalStatus } from '@portfolio/contracts';

export class InMemoryProposalRepository implements IProposalRepository {
  private rows: StoredProposal[] = [];

  /** Every stored row, for assertions. */
  all(): readonly StoredProposal[] {
    return structuredClone(this.rows);
  }

  insertPending(proposal: NewProposal): Promise<StoredProposal> {
    const inFlight = this.rows.find((row) => row.portfolioId === proposal.portfolioId && row.status === 'pending');
    if (inFlight) {
      return Promise.reject(new ConflictError('GENERATION_IN_PROGRESS', { proposalId: inFlight.id }, 'A design proposal is already being generated'));
    }
    const stored: StoredProposal = {
      ...structuredClone(proposal),
      // Real ObjectIds, so ids order like MongoDB's and malformed ids find nothing.
      id: new Types.ObjectId().toString(),
      status: 'pending',
      design: null,
      rationale: null,
      failure: null,
      charge: { ...proposal.charge, refunded: false },
      durationMs: 0,
      completedAt: null,
    };
    this.rows.push(stored);
    return Promise.resolve(structuredClone(stored));
  }

  findById(portfolioId: string, proposalId: string): Promise<StoredProposal | null> {
    return Promise.resolve(this.clone(this.find(portfolioId, proposalId)));
  }

  list(portfolioId: string, limit: number, cursor?: string): Promise<StoredProposal[]> {
    const visible = this.rows
      .filter((row) => row.portfolioId === portfolioId && row.status !== 'discarded')
      .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
    let start = 0;
    if (cursor !== undefined) {
      const last = this.find(portfolioId, cursor);
      if (!last) return Promise.resolve([]);
      start = visible.findIndex(
        (row) => row.createdAt < last.createdAt || (row.createdAt.getTime() === last.createdAt.getTime() && row.id < last.id),
      );
      if (start === -1) return Promise.resolve([]);
    }
    return Promise.resolve(structuredClone(visible.slice(start, start + limit)));
  }

  complete(portfolioId: string, proposalId: string, outcome: ProposalOutcome): Promise<StoredProposal | null> {
    const fields =
      outcome.status === 'ready'
        ? { status: 'ready' as const, design: outcome.design, rationale: outcome.rationale, failure: null }
        : { status: 'failed' as const, design: null, rationale: null, failure: outcome.failure };
    return this.update(portfolioId, proposalId, 'pending', (row) => ({
      ...row,
      ...structuredClone(fields),
      durationMs: outcome.durationMs,
      completedAt: outcome.completedAt,
    }));
  }

  transition(portfolioId: string, proposalId: string, from: ProposalStatus, to: ProposalStatus): Promise<StoredProposal | null> {
    return this.update(portfolioId, proposalId, from, (row) => ({ ...row, status: to }));
  }

  markRefunded(portfolioId: string, proposalId: string): Promise<boolean> {
    const row = this.find(portfolioId, proposalId);
    if (!row || row.charge.kind === 'none' || row.charge.refunded) return Promise.resolve(false);
    this.replace({ ...row, charge: { ...row.charge, refunded: true } });
    return Promise.resolve(true);
  }

  countFreeSince(portfolioId: string, since: Date): Promise<number> {
    return Promise.resolve(
      this.rows.filter(
        (row) => row.portfolioId === portfolioId && row.createdAt >= since && row.charge.kind === 'free' && !row.charge.refunded,
      ).length,
    );
  }

  listPending(): Promise<StoredProposal[]> {
    return Promise.resolve(structuredClone(this.rows.filter((row) => row.status === 'pending')));
  }

  deletePending(portfolioId: string, proposalId: string): Promise<boolean> {
    const row = this.find(portfolioId, proposalId);
    if (row?.status !== 'pending') return Promise.resolve(false);
    this.rows = this.rows.filter((candidate) => candidate !== row);
    return Promise.resolve(true);
  }

  private update(
    portfolioId: string,
    proposalId: string,
    from: ProposalStatus,
    change: (row: StoredProposal) => StoredProposal,
  ): Promise<StoredProposal | null> {
    const row = this.find(portfolioId, proposalId);
    if (row?.status !== from) return Promise.resolve(null);
    const updated = change(row);
    this.replace(updated);
    return Promise.resolve(structuredClone(updated));
  }

  private find(portfolioId: string, proposalId: string): StoredProposal | undefined {
    return this.rows.find((row) => row.portfolioId === portfolioId && row.id === proposalId);
  }

  private replace(row: StoredProposal): void {
    this.rows = this.rows.map((candidate) => (candidate.id === row.id ? row : candidate));
  }

  private clone(row: StoredProposal | undefined): StoredProposal | null {
    return row ? structuredClone(row) : null;
  }
}
