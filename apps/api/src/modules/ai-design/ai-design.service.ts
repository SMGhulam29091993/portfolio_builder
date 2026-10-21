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
 * Logs carry ids, statuses and durations — never the prompt text or a key (AC15). A provider
 * failure is logged with its cause (`HTTP 400`, `HTTP 402`, a timeout…) so it can be diagnosed;
 * the proposal, and so the user, only ever gets the plain message of its failure code.
 */
import { ConflictError, CreditsRequiredError, NotFoundError, UpstreamError } from '../../core/errors/index.js';
import type { IBackgroundRunner } from '../../core/background/index.js';
import type { ILogger } from '../../core/logger/logger.interface.js';
import type { IClock } from '../auth/index.js';
import type { IDesignReader, IDesignWriter, ILayoutLibraryWriter, IPresetWriter } from '../design/index.js';
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
  DesignPreset,
  DesignSpec,
  Proposal,
  ProposalFailure,
  ProposalFailureCode,
  ProposalOutcome,
  ProposalPage,
  ProposedDesignSpec,
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
    private readonly layoutLibrary: ILayoutLibraryWriter,
    private readonly presets: IPresetWriter,
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
      explore: request.explore,
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
    // A stale revision is refused before anything is saved, so it leaves no layouts behind.
    const { revision } = await this.designReader.read(subject.portfolioId);
    if (revision !== expectedDesignRevision) {
      throw new ConflictError('REVISION_CONFLICT', { currentRevision: revision }, 'This was changed elsewhere. Reload to see the latest version');
    }
    // Claimed first, so a racing discard or second apply sees `applied` and stops.
    const claimed = await this.proposals.transition(subject.portfolioId, proposalId, 'ready', 'applied');
    if (claimed === null) throw notReady(await this.find(subject, proposalId));
    try {
      // Custom layouts go to the library first; the design then names them (`design-library.AC8`).
      const resolved = await this.saveCustomLayouts(subject, proposal, proposal.design, 'ai');
      const design = await this.designWriter.apply(subject.portfolioId, resolved, expectedDesignRevision);
      await this.proposals.recordAppliedDesign(subject.portfolioId, proposalId, resolved);
      return { design, proposal: toContract({ ...claimed, design: resolved }) };
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

  async savePreset(subject: AllowanceSubject, proposalId: string, name: string): Promise<DesignPreset> {
    const proposal = await this.find(subject, proposalId);
    if ((proposal.status !== 'ready' && proposal.status !== 'applied') || proposal.design === null) throw notReady(proposal);
    // An applied proposal already names its library layouts; a ready one saves its own first.
    const design = await this.saveCustomLayouts(subject, proposal, proposal.design, 'preset');
    return this.presets.savePreset(subject.portfolioId, name, design);
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
      explore: proposal.explore,
    });

    for (let attempt = 1; ; attempt += 1) {
      let text: string;
      try {
        // The timeout decorator owns aborting; this signal is never aborted here.
        ({ text } = await this.active.generator.generate(request, new AbortController().signal));
      } catch (error) {
        if (!(error instanceof UpstreamError)) throw error;
        this.logger.warn('design provider call failed', {
          proposalId: proposal.id,
          provider: proposal.provider,
          attempt,
          reason: error.message,
          cause: upstreamCause(error),
        });
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

  /**
   * Saves a proposal's custom layouts to the library and returns its design naming them as
   * `custom:<id>`; a design without any is returned as it is.
   */
  private async saveCustomLayouts(
    subject: AllowanceSubject,
    proposal: StoredProposal,
    design: ProposedDesignSpec,
    source: 'ai' | 'preset',
  ): Promise<DesignSpec> {
    const { customLayouts, ...spec } = design;
    const entries = Object.values(customLayouts ?? {});
    if (entries.length === 0) return spec;
    // Named from the request, so the library says where each came from.
    const base = proposal.prompt.length > 44 ? `${proposal.prompt.slice(0, 43).trimEnd()}…` : proposal.prompt;
    const saved = await this.layoutLibrary.saveLayouts(
      subject.portfolioId,
      entries.map((layout) => ({ name: `${base} · ${layout.section}`, layout, source })),
    );
    const layout: Record<string, string> = { ...spec.layout };
    for (const stored of saved) layout[stored.section] = `custom:${stored.id}`;
    return { ...spec, layout: layout as DesignSpec['layout'] };
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

/** An `HTTP <status>` cause as it is; any other only by its type, as its message could echo a response. */
const HTTP_STATUS_CAUSE = /^HTTP \d{3}$/;

/** What an `UpstreamError` was caused by, safe to log: `HTTP 402`, `TypeError`, … or `null`. */
function upstreamCause(error: UpstreamError): string | null {
  const { cause } = error;
  if (!(cause instanceof Error)) return null;
  return HTTP_STATUS_CAUSE.test(cause.message) ? cause.message : cause.name;
}

/** The proposal as the API returns it: no owner ids, ISO dates. */
function toContract(proposal: StoredProposal): Proposal {
  return {
    id: proposal.id,
    status: proposal.status,
    prompt: proposal.prompt,
    scope: proposal.scope,
    basedOnCurrent: proposal.basedOnCurrent,
    explore: proposal.explore,
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
