/**
 * Contracts of the `ai-design` module (`ai-design-studio` plan → Architecture Approach). Each
 * port is role-sized; the service, generator and allowance ports join this file in their tasks.
 */
import type { NewProposal, ProposalOutcome, ProposalStatus, StoredProposal } from './ai-design.types.js';

/** The `design_proposals` collection; every read and write is scoped by `portfolioId`. */
export interface IProposalRepository {
  /**
   * Stores a `pending` proposal. The partial unique index allows one `pending` proposal per
   * portfolio, so two racing requests cannot both be stored (AC7, IT14).
   * @throws {ConflictError} `GENERATION_IN_PROGRESS` with `proposalId` of the one in flight.
   */
  insertPending(proposal: NewProposal): Promise<StoredProposal>;
  findById(portfolioId: string, proposalId: string): Promise<StoredProposal | null>;
  /**
   * Newest first, `discarded` excluded (API03). `cursor` is the id of the last proposal of the
   * previous page; an unknown cursor yields an empty page.
   */
  list(portfolioId: string, limit: number, cursor?: string): Promise<StoredProposal[]>;
  /**
   * Ends a `pending` proposal as `ready` or `failed`.
   * @returns `null` when it is no longer `pending` (or does not exist) — nothing changed.
   */
  complete(portfolioId: string, proposalId: string, outcome: ProposalOutcome): Promise<StoredProposal | null>;
  /**
   * Moves a proposal from `from` to `to` in one conditional write (apply, discard).
   * @returns `null` when its status was not `from` — nothing changed.
   */
  transition(portfolioId: string, proposalId: string, from: ProposalStatus, to: ProposalStatus): Promise<StoredProposal | null>;
  /**
   * Marks a charged proposal's charge as given back, once (AC17, UT16).
   * @returns `false` when it was already refunded, never charged, or does not exist.
   */
  markRefunded(portfolioId: string, proposalId: string): Promise<boolean>;
  /** Free generations created at or after `since` and not given back (AC17). */
  countFreeSince(portfolioId: string, since: Date): Promise<number>;
  /** Every `pending` proposal of every portfolio — read once at startup (AC10). */
  listPending(): Promise<StoredProposal[]>;
}
