/**
 * Contracts of the `ai-design` module (`ai-design-studio` plan → Architecture Approach). Each
 * port is role-sized; the service, generator and allowance ports join this file in their tasks.
 */
import type {
  AiProviderId,
  AiProviderInfo,
  AllowanceQuote,
  AllowanceSubject,
  AnswerIssue,
  AppliedProposal,
  CreateProposalRequest,
  DesignSpec,
  GenerationRequest,
  GenerationResult,
  NewProposal,
  ParsedAnswer,
  PromptInput,
  ProposalOutcome,
  Proposal,
  ProposalCharge,
  ProposalPage,
  ProposalScope,
  ProposalStatus,
  StoredProposal,
  UserRole,
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

/**
 * The one way adapters reach a provider (`ai-design-studio` plan → adapters depend on
 * `IHttpClient`). It owns the transport rules every adapter shares, so each adapter only
 * translates its wire format (Single Responsibility).
 */
export interface IHttpClient {
  /**
   * POSTs `body` as JSON and returns the parsed JSON answer.
   * @throws {ProviderRejectedError} A 4xx other than 429 — the request itself was refused.
   * @throws {UpstreamError} Anything else: network failure, abort, 429, 5xx, a body that is not JSON.
   */
  postJson(
    provider: AiProviderId,
    url: string,
    headers: Readonly<Record<string, string>>,
    body: unknown,
    signal: AbortSignal,
  ): Promise<unknown>;
  /** `true` when a GET of `url` answers 2xx within `timeoutMs`; never throws. */
  probe(url: string, headers: Readonly<Record<string, string>>, timeoutMs: number): Promise<boolean>;
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
  /**
   * Removes a `pending` proposal whose charge could not be taken after all (a credit spend that
   * lost a race), so nothing is left that was never paid for.
   * @returns `false` when it is not `pending` or does not exist.
   */
  deletePending(portfolioId: string, proposalId: string): Promise<boolean>;
}

/** The section types a portfolio shows, in page order; adapted from `portfolio` in the container. */
export interface ISectionTypeLister {
  listVisible(portfolioId: string): Promise<readonly string[]>;
}

/** A user's role; adapted from `auth`'s user reader in the container. */
export interface IUserRoleReader {
  /** `null` for an unknown user. */
  roleOf(userId: string): Promise<UserRole | null>;
}

/**
 * What AI generations cost (ADR-0012). `DefaultAiPricing` serves the seeded defaults until
 * `platform-admin` makes them settings and replaces it in the container.
 */
export interface IAiPricing {
  current(): Promise<{ readonly freeMonthly: number; readonly creditCost: number }>;
}

/**
 * A user's credits (ADR-0012). `EmptyGenerationWallet` holds none until `credits-billing`
 * replaces it in the container. `reference` is the proposal id, so a spend and its refund pair up.
 */
export interface IGenerationWallet {
  balance(userId: string): Promise<number>;
  /** @returns `false` when the balance is too low — nothing was taken. */
  spend(userId: string, credits: number, reference: string): Promise<boolean>;
  refund(userId: string, credits: number, reference: string): Promise<void>;
}

/** Who may generate, at what charge (AC7, AC17, AC18). */
export interface IGenerationAllowance {
  /** The allowance as API06 shows it, and the charge the next generation would take. */
  quote(subject: AllowanceSubject): Promise<AllowanceQuote>;
  /**
   * Takes the charge of a stored proposal: spends its credits, if it has any.
   * @returns `false` when the credits could not be taken.
   */
  settle(subject: AllowanceSubject, proposalId: string, charge: Omit<ProposalCharge, 'refunded'>): Promise<boolean>;
  /** Gives back what a proposal used when it failed through the platform's or provider's fault. */
  refund(proposal: StoredProposal): Promise<void>;
}

/** `ai-design-studio.API01`–`API06`, for the controller. */
export interface IAiDesignService {
  /**
   * @throws {CreditsRequiredError} The free allowance is used up and the credits do not cover one.
   * @throws {ConflictError} `GENERATION_IN_PROGRESS` with `proposalId`.
   */
  create(subject: AllowanceSubject, request: CreateProposalRequest): Promise<Proposal>;
  /** @throws {NotFoundError} */
  get(subject: AllowanceSubject, proposalId: string): Promise<Proposal>;
  list(subject: AllowanceSubject, limit: number, cursor?: string): Promise<ProposalPage>;
  /**
   * @throws {NotFoundError}
   * @throws {ConflictError} `PROPOSAL_NOT_READY` with `status`; `REVISION_CONFLICT`.
   * @throws {ValidationError} The stored design no longer validates.
   */
  apply(subject: AllowanceSubject, proposalId: string, expectedDesignRevision: number): Promise<AppliedProposal>;
  /** @throws {NotFoundError} @throws {ConflictError} `PROPOSAL_NOT_READY` (pending, applied). */
  discard(subject: AllowanceSubject, proposalId: string): Promise<Proposal>;
  provider(subject: AllowanceSubject): Promise<AiProviderInfo>;
}

/** Ends work a restart cut short (AC10); called by `InterruptedProposalRecovery`. */
export interface IInterruptedWorkRecovery {
  /** @returns How many proposals were marked `INTERRUPTED`. */
  recoverInterrupted(): Promise<number>;
}
