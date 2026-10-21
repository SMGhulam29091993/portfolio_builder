/**
 * Contracts of the `ai-design` module (`ai-design-studio` plan → Architecture Approach). Each
 * port is role-sized; the service, generator and allowance ports join this file in their tasks.
 */
import type {
  AiProviderId,
  AnswerIssue,
  DesignSpec,
  GenerationRequest,
  GenerationResult,
  NewProposal,
  ParsedAnswer,
  PromptInput,
  ProposalOutcome,
  ProposalScope,
  ProposalStatus,
  StoredProposal,
} from './ai-design.types.js';

/**
 * The design-generation port (`ai-design-studio` → Provider contract, the canonical owner;
 * ADR-0003). Every adapter and decorator passes the shared contract suite (AC13).
 */
export interface IDesignGenerator {
  readonly providerId: AiProviderId;
  /**
   * Returns the model's raw text. Never parses, validates or retries.
   * @throws {UpstreamError} Every transport failure, an abort included — no provider type.
   */
  generate(request: GenerationRequest, signal: AbortSignal): Promise<GenerationResult>;
}

/** Whether the provider answers at all (API06); split from generation (Interface Segregation). */
export interface IProviderHealth {
  /** Never throws: an unreachable provider is `{ reachable: false }`. */
  check(): Promise<{ reachable: boolean }>;
}

/** The generator `DesignGeneratorFactory` chose for this environment, with what API06 reports. */
export interface ActiveDesignGenerator {
  readonly generator: IDesignGenerator;
  readonly health: IProviderHealth;
  /** `AI_MODEL`, or the stub's fixture name. */
  readonly model: string;
}

/**
 * Builds the provider-agnostic request (`ai-design-studio.T03`). Knows nothing about providers;
 * sends the catalogue, the font allow-list, the contrast rules, the scope and — when asked —
 * the current design, and nothing about the person (AC15).
 */
export interface IDesignPromptBuilder {
  build(input: PromptInput): GenerationRequest;
  /** The one repair attempt (AC3, AC4): the previous answer and why it cannot be used. */
  repair(request: GenerationRequest, answer: string, issues: readonly AnswerIssue[]): GenerationRequest;
}

/**
 * Turns a provider's raw text into a usable design, or says why not (`ai-design-studio.T03`).
 * Knows nothing about transport. Model output is data, never code (ADR-0006).
 */
export interface IDesignSpecParser {
  /**
   * @param current - The draft design at generation time; the part outside `scope` is copied
   *   from it whatever the model returned (AC5).
   */
  parse(text: string, scope: ProposalScope, current: DesignSpec): ParsedAnswer;
}

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
