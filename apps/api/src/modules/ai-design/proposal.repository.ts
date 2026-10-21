/**
 * MongoDB access for `design_proposals` (`ai-design-studio.T01`; AC1, AC7). Every status change
 * is one conditional update on the expected status, so a proposal cannot be completed twice or
 * applied while it is being discarded.
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type { IProposalRepository } from './ai-design.interface.js';
import type {
  DesignSpec,
  NewProposal,
  ProposalOutcome,
  ProposalStatus,
  StoredProposal,
} from './ai-design.types.js';
import { proposalModel, type ProposalDocument } from './proposal.model.js';

const DUPLICATE_KEY = 11_000;
/** An insert that lost to a pending proposal which finished at once is tried this many times. */
const INSERT_ATTEMPTS = 2;

type LeanProposal = ProposalDocument & { _id: { toString(): string } };

export class ProposalRepository implements IProposalRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async insertPending(proposal: NewProposal): Promise<StoredProposal> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const created = await this.model().create({
          ...proposal,
          status: 'pending',
          charge: { ...proposal.charge, refunded: false },
        });
        return toProposal(created.toObject());
      } catch (error) {
        if (!isDuplicateKey(error)) throw error;
        const inFlight = await this.model()
          .findOne({ portfolioId: proposal.portfolioId, status: 'pending' }, { _id: 1 })
          .lean<{ _id: { toString(): string } }>()
          .exec();
        // The pending proposal ended between the insert and this read: the slot is free again.
        if (!inFlight && attempt < INSERT_ATTEMPTS) continue;
        throw new ConflictError(
          'GENERATION_IN_PROGRESS',
          { proposalId: inFlight?._id.toString() ?? null },
          'A design proposal is already being generated',
        );
      }
    }
  }

  async findById(portfolioId: string, proposalId: string): Promise<StoredProposal | null> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(proposalId)) return null;
    const found = await this.model().findOne({ _id: proposalId, portfolioId }).lean<LeanProposal>().exec();
    return found ? toProposal(found) : null;
  }

  async list(portfolioId: string, limit: number, cursor?: string): Promise<StoredProposal[]> {
    if (!isValidObjectId(portfolioId)) return [];
    const visible = { portfolioId, status: { $ne: 'discarded' } };
    let filter: Record<string, unknown> = visible;
    if (cursor !== undefined) {
      if (!isValidObjectId(cursor)) return [];
      const last = await this.model()
        .findOne({ _id: cursor, portfolioId }, { createdAt: 1 })
        .lean<{ createdAt: Date }>()
        .exec();
      if (!last) return [];
      // Newest first by `createdAt`, ties broken by id, so a page boundary never skips a row.
      filter = {
        ...visible,
        $or: [{ createdAt: { $lt: last.createdAt } }, { createdAt: last.createdAt, _id: { $lt: cursor } }],
      };
    }
    const rows = await this.model()
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit)
      .lean<LeanProposal[]>()
      .exec();
    return rows.map(toProposal);
  }

  async complete(portfolioId: string, proposalId: string, outcome: ProposalOutcome): Promise<StoredProposal | null> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(proposalId)) return null;
    const fields =
      outcome.status === 'ready'
        ? { status: 'ready', design: outcome.design, rationale: outcome.rationale, failure: null }
        : { status: 'failed', design: null, rationale: null, failure: outcome.failure };
    const updated = await this.model()
      .findOneAndUpdate(
        { _id: proposalId, portfolioId, status: 'pending' },
        { $set: { ...fields, durationMs: outcome.durationMs, completedAt: outcome.completedAt } },
        { returnDocument: 'after' },
      )
      .lean<LeanProposal>()
      .exec();
    return updated ? toProposal(updated) : null;
  }

  async transition(
    portfolioId: string,
    proposalId: string,
    from: ProposalStatus,
    to: ProposalStatus,
  ): Promise<StoredProposal | null> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(proposalId)) return null;
    const updated = await this.model()
      .findOneAndUpdate({ _id: proposalId, portfolioId, status: from }, { $set: { status: to } }, { returnDocument: 'after' })
      .lean<LeanProposal>()
      .exec();
    return updated ? toProposal(updated) : null;
  }

  async markRefunded(portfolioId: string, proposalId: string): Promise<boolean> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(proposalId)) return false;
    // `refunded: false` in the filter makes a second refund match nothing (UT16: refunded once).
    const result = await this.model()
      .updateOne(
        { _id: proposalId, portfolioId, 'charge.kind': { $ne: 'none' }, 'charge.refunded': false },
        { $set: { 'charge.refunded': true } },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  async countFreeSince(portfolioId: string, since: Date): Promise<number> {
    if (!isValidObjectId(portfolioId)) return 0;
    return this.model()
      .countDocuments({ portfolioId, createdAt: { $gte: since }, 'charge.kind': 'free', 'charge.refunded': false })
      .exec();
  }

  async listPending(): Promise<StoredProposal[]> {
    const rows = await this.model().find({ status: 'pending' }).lean<LeanProposal[]>().exec();
    return rows.map(toProposal);
  }

  private model() {
    return proposalModel(this.connections.getConnection());
  }
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === DUPLICATE_KEY;
}

function toProposal(document: LeanProposal): StoredProposal {
  return {
    id: document._id.toString(),
    portfolioId: document.portfolioId.toString(),
    userId: document.userId.toString(),
    status: document.status,
    prompt: document.prompt,
    scope: document.scope,
    basedOnCurrent: document.basedOnCurrent,
    provider: document.provider,
    model: document.model,
    design: (document.design ?? null) as DesignSpec | null,
    rationale: document.rationale,
    failure: document.failure ? { code: document.failure.code, message: document.failure.message } : null,
    charge: { kind: document.charge.kind, credits: document.charge.credits, refunded: document.charge.refunded },
    durationMs: document.durationMs,
    createdAt: document.createdAt,
    completedAt: document.completedAt,
  };
}
