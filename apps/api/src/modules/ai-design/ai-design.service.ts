/**
 * `AiDesignService` (`ai-design-studio.T04`; AC1–AC4, AC7–AC10, AC17): orchestration only. The
 * prompt builder, the generator, the parser, the allowance and the design writer each do their
 * own job; this class puts them in order.
 *
 * - `create` decides the charge, stores a `pending` proposal (the partial unique index keeps one
 *   in flight), takes the charge, starts the run in the background and returns at once (AC1).
 * - The run asks the provider, parses the answer, and makes **one** repair attempt with the
 *   reasons when it cannot be used (AC3, AC4). Every way it ends is recorded on the proposal; a
 *   provider failure never becomes an HTTP error (spec → Error Handling).
 * - Applying goes through `IDesignWriter`, so `design` stays the only writer of `designs` (AC8).
 *
 * Logs carry ids, statuses and durations — never the prompt text or a key (AC15).
 */
import { ConflictError, CreditsRequiredError, NotFoundError, UpstreamError } from '../../core/errors/index.js';
import type { IBackgroundRunner } from '../../core/background/index.js';
import type { ILogger } from '../../core/logger/logger.interface.js';
import type { IClock } from '../auth/index.js';
import type { IDesignReader, IDesignWriter } from '../design/index.js';
import { ProviderTimeoutError } from './ai-design.errors.js';
import type {
  ActiveDesignGenerator,
  IAiDesignService,
  IDesignPromptBuilder,
  IDesignSpecParser,
  IGenerationAllowance,
  IInterruptedWorkRecovery,
  IProposalRepository,
  ISectionTypeLister,
} from './ai-design.interface.js';
import type {
  AiProviderInfo,
  AllowanceSubject,
  AppliedProposal,
  CreateProposalRequest,
  DesignSpec,
  Proposal,
  ProposalFailure,
  ProposalFailureCode,
  ProposalOutcome,
  ProposalPage,
  StoredProposal,
} from './ai-design.types.js';

/** Attempts per generation: the first answer and one repair (AC3, AC4). */
const MAX_ATTEMPTS = 2;

/** What each failure tells the user, in plain language (AC16). */
const FAILURE_MESSAGES: Readonly<Record<ProposalFailureCode, string>> = {
  PROVIDER_TIMEOUT: 'The design provider did not answer in time. Try again.',
  PROVIDER_ERROR: 'The design provider could not be reached or returned an error. Try again.',
  INVALID_OUTPUT: 'The provider did not return a design that could be used, even after a second try.',
  CONTRAST_FAILED: 'The proposed colours did not meet the contrast rules, even after a second try.',
  INTERRUPTED: 'Generation stopped because the server restarted. Start a new one.',
};

export class AiDesignService implements IAiDesignService, IInterruptedWorkRecovery {
  constructor(
    private readonly proposals: IProposalRepository,
    private readonly active: ActiveDesignGenerator,
    private readonly promptBuilder: IDesignPromptBuilder,
    private readonly parser: IDesignSpecParser,
    private readonly designReader: IDesignReader,
    private readonly designWriter: IDesignWriter,
    private readonly sections: ISectionTypeLister,
    private readonly allowance: IGenerationAllowance,
    private readonly runner: IBackgroundRunner,
    private readonly clock: IClock,
    private readonly logger: ILogger,
  ) {}

  async create(subject: AllowanceSubject, request: CreateProposalRequest): Promise<Proposal> {
    const { allowance, next } = await this.allowance.quote(subject);
    if (next === null) throw new CreditsRequiredError(allowance.creditCost, allowance.balance ?? 0);

    const proposal = await this.proposals.insertPending({
      portfolioId: subject.portfolioId,
      userId: subject.userId,
      prompt: request.prompt,
      scope: request.scope,
      basedOnCurrent: request.basedOnCurrent,
      provider: this.active.generator.providerId,
      model: this.active.model,
      charge: next,
      createdAt: this.clock.now(),
    });
    // Charged only once the proposal is stored, so a request that lost the race paid nothing.
    if (!(await this.allowance.settle(subject, proposal.id, next))) {
      await this.proposals.deletePending(subject.portfolioId, proposal.id);
      throw new CreditsRequiredError(next.credits, allowance.balance ?? 0);
    }

    this.runner.run(`design proposal ${proposal.id}`, () => this.run(proposal));
    return toContract(proposal);
  }

  /**
   * Generates and records the outcome of a `pending` proposal. Never rejects: a crash is logged
   * with the proposal id and recorded as `PROVIDER_ERROR`, so nothing stays `pending`.
   */
  async run(proposal: StoredProposal): Promise<void> {
    const started = this.clock.now().getTime();
    let outcome: ProposalOutcome;
    try {
      outcome = await this.generate(proposal, started);
    } catch (error) {
      this.logger.error('design proposal crashed', { proposalId: proposal.id, error });
      outcome = this.failed('PROVIDER_ERROR', started);
    }
    const completed = await this.proposals.complete(proposal.portfolioId, proposal.id, outcome);
    if (completed === null) return;
    this.logger.info('design proposal completed', {
      proposalId: completed.id,
      status: completed.status,
      failure: completed.failure?.code ?? null,
      provider: completed.provider,
      durationMs: completed.durationMs,
    });
    await this.allowance.refund(completed);
  }

  async get(subject: AllowanceSubject, proposalId: string): Promise<Proposal> {
    return toContract(await this.find(subject, proposalId));
  }

  async list(subject: AllowanceSubject, limit: number, cursor?: string): Promise<ProposalPage> {
    // One more than asked shows whether another page exists.
    const rows = await this.proposals.list(subject.portfolioId, limit + 1, cursor);
    const page = rows.slice(0, limit);
    return { proposals: page.map(toContract), nextCursor: rows.length > limit ? (page.at(-1)?.id ?? null) : null };
  }

  async apply(subject: AllowanceSubject, proposalId: string, expectedDesignRevision: number): Promise<AppliedProposal> {
    const proposal = await this.find(subject, proposalId);
    if (proposal.status !== 'ready' || proposal.design === null) throw notReady(proposal);
    // Claimed first, so a racing discard or second apply sees `applied` and stops.
    const claimed = await this.proposals.transition(subject.portfolioId, proposalId, 'ready', 'applied');
    if (claimed === null) throw notReady(await this.find(subject, proposalId));
    try {
      const design = await this.designWriter.apply(subject.portfolioId, proposal.design, expectedDesignRevision);
      return { design, proposal: toContract(claimed) };
    } catch (error) {
      // A stale revision or a design that no longer validates leaves the proposal usable (AC9).
      await this.proposals.transition(subject.portfolioId, proposalId, 'applied', 'ready');
      throw error;
    }
  }

  async discard(subject: AllowanceSubject, proposalId: string): Promise<Proposal> {
    const proposal = await this.find(subject, proposalId);
    if (proposal.status !== 'ready' && proposal.status !== 'failed') throw notReady(proposal);
    const discarded = await this.proposals.transition(subject.portfolioId, proposalId, proposal.status, 'discarded');
    if (discarded === null) throw notReady(await this.find(subject, proposalId));
    return toContract(discarded);
  }

  async provider(subject: AllowanceSubject): Promise<AiProviderInfo> {
    const [{ reachable }, { allowance }] = await Promise.all([this.active.health.check(), this.allowance.quote(subject)]);
    const provider = this.active.generator.providerId;
    return { provider, model: this.active.model, isStub: provider === 'stub', reachable, allowance };
  }

  async recoverInterrupted(): Promise<number> {
    let recovered = 0;
    for (const proposal of await this.proposals.listPending()) {
      const completed = await this.proposals.complete(proposal.portfolioId, proposal.id, this.failed('INTERRUPTED', proposal.createdAt.getTime()));
      if (completed === null) continue;
      recovered += 1;
      await this.allowance.refund(completed);
    }
    if (recovered > 0) this.logger.info('interrupted design proposals failed', { count: recovered });
    return recovered;
  }

  /** The provider round trips: an answer, and one repair when it cannot be used. */
  private async generate(proposal: StoredProposal, started: number): Promise<ProposalOutcome> {
    const stored = await this.designReader.read(proposal.portfolioId);
    const current: DesignSpec = { theme: stored.theme, layout: stored.layout };
    let request = this.promptBuilder.build({
      prompt: proposal.prompt,
      scope: proposal.scope,
      current: proposal.basedOnCurrent ? current : null,
      visibleSections: await this.sections.listVisible(proposal.portfolioId),
    });

    for (let attempt = 1; ; attempt += 1) {
      let text: string;
      try {
        // The timeout decorator owns aborting; this signal is never aborted here.
        ({ text } = await this.active.generator.generate(request, new AbortController().signal));
      } catch (error) {
        if (!(error instanceof UpstreamError)) throw error;
        return this.failed(error instanceof ProviderTimeoutError ? 'PROVIDER_TIMEOUT' : 'PROVIDER_ERROR', started);
      }
      const answer = this.parser.parse(text, proposal.scope, current);
      if (answer.ok) {
        return { status: 'ready', design: answer.design, rationale: answer.rationale, ...this.finished(started) };
      }
      if (attempt >= MAX_ATTEMPTS) return this.failed(answer.code, started);
      request = this.promptBuilder.repair(request, text, answer.issues);
    }
  }

  private failed(code: ProposalFailureCode, started: number): ProposalOutcome {
    const failure: ProposalFailure = { code, message: FAILURE_MESSAGES[code] };
    return { status: 'failed', failure, ...this.finished(started) };
  }

  private finished(started: number): { durationMs: number; completedAt: Date } {
    const completedAt = this.clock.now();
    return { durationMs: Math.max(0, completedAt.getTime() - started), completedAt };
  }

  private async find(subject: AllowanceSubject, proposalId: string): Promise<StoredProposal> {
    const proposal = await this.proposals.findById(subject.portfolioId, proposalId);
    // Another portfolio's proposal answers as if it did not exist (tenant isolation).
    if (proposal === null) throw new NotFoundError('Design proposal not found');
    return proposal;
  }
}

function notReady(proposal: StoredProposal): ConflictError {
  return new ConflictError('PROPOSAL_NOT_READY', { status: proposal.status }, 'The design proposal is not ready');
}

/** The proposal as the API returns it: no owner ids, ISO dates. */
function toContract(proposal: StoredProposal): Proposal {
  return {
    id: proposal.id,
    status: proposal.status,
    prompt: proposal.prompt,
    scope: proposal.scope,
    basedOnCurrent: proposal.basedOnCurrent,
    provider: proposal.provider,
    model: proposal.model,
    design: proposal.design,
    rationale: proposal.rationale,
    failure: proposal.failure,
    charge: proposal.charge,
    durationMs: proposal.durationMs,
    createdAt: proposal.createdAt.toISOString(),
    completedAt: proposal.completedAt?.toISOString() ?? null,
  };
}
