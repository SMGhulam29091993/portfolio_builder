/**
 * Domain types of the `ai-design` module (`ai-design-studio` plan → Data Model). Request and
 * response shapes are owned by `packages/contracts`; the design shape by `packages/design-tokens`.
 */
import type {
  AiProviderId,
  ProposalCharge,
  ProposalFailureCode,
  ProposalScope,
  ProposalStatus,
} from '@portfolio/contracts';
import type { GenerationAllowance, Proposal } from '@portfolio/contracts';
import type { DesignSpec } from '@portfolio/design-tokens';

import type { CmsDesign } from '../design/index.js';

export {
  AI_PROVIDER_IDS,
  applyProposalRequestSchema,
  createProposalRequestSchema,
  listProposalsQuerySchema,
  PROMPT_MAX_LENGTH,
  PROPOSAL_FAILURE_CODES,
  PROPOSAL_SCOPES,
  PROPOSAL_STATUSES,
  proposalIdParamsSchema,
  RATIONALE_MAX_LENGTH,
  REFUNDABLE_FAILURES,
  type AiProviderId,
  type AiProviderInfo,
  type ApplyProposalRequest,
  type CreateProposalRequest,
  type GenerationAllowance,
  type ListProposalsQuery,
  type Proposal,
  type ProposalCharge,
  type ProposalFailureCode,
  type ProposalScope,
  type ProposalStatus,
} from '@portfolio/contracts';
export type { DesignSpec } from '@portfolio/design-tokens';

/** The roles `auth` knows (ADR-0010); the owner generates without limit (AC17). */
export type UserRole = 'owner' | 'member';

/** Who a request acts for: the signed-in user and the portfolio they own (ADR-0010). */
export interface AllowanceSubject {
  readonly userId: string;
  readonly portfolioId: string;
}

/** The allowance and what the next generation would cost; `next: null` means refused (402). */
export interface AllowanceQuote {
  readonly allowance: GenerationAllowance;
  readonly next: Omit<ProposalCharge, 'refunded'> | null;
}

/** API03 — a page of proposals. */
export interface ProposalPage {
  readonly proposals: readonly Proposal[];
  readonly nextCursor: string | null;
}

/** API04 — the draft design after the apply, and the applied proposal. */
export interface AppliedProposal {
  readonly design: CmsDesign;
  readonly proposal: Proposal;
}

/** Why a proposal failed, as stored and returned (`ai-design-studio` → Proposal). */
export interface ProposalFailure {
  readonly code: ProposalFailureCode;
  readonly message: string;
}

/** A proposal as the repository stores it: the contract's `Proposal` plus its owners, with dates. */
export interface StoredProposal {
  readonly id: string;
  readonly portfolioId: string;
  readonly userId: string;
  readonly status: ProposalStatus;
  readonly prompt: string;
  readonly scope: ProposalScope;
  readonly basedOnCurrent: boolean;
  readonly provider: AiProviderId;
  readonly model: string;
  /** A validated, scope-merged design; set only once the proposal is `ready`. */
  readonly design: DesignSpec | null;
  readonly rationale: string | null;
  readonly failure: ProposalFailure | null;
  readonly charge: ProposalCharge;
  readonly durationMs: number;
  readonly createdAt: Date;
  readonly completedAt: Date | null;
}

/** What `create` stores: a `pending` proposal with its charge decided (AC1, AC17). */
export interface NewProposal {
  readonly portfolioId: string;
  readonly userId: string;
  readonly prompt: string;
  readonly scope: ProposalScope;
  readonly basedOnCurrent: boolean;
  readonly provider: AiProviderId;
  readonly model: string;
  readonly charge: Omit<ProposalCharge, 'refunded'>;
  readonly createdAt: Date;
}

/** One turn of the conversation sent to a provider; a repair attempt adds two (AC3, AC4). */
export interface GenerationMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
}

/**
 * What every provider receives (`ai-design-studio` → Provider contract), built by the prompt
 * builder and translated to a wire format by each adapter. It carries no owner name, email or
 * section text (AC15).
 */
export interface GenerationRequest {
  /** The system instructions: the catalogue, the font allow-list, the rules. */
  readonly instructions: string;
  readonly messages: readonly GenerationMessage[];
  /** The JSON Schema of the expected answer, derived from the `DesignSpec` zod schema. */
  readonly schema: Readonly<Record<string, unknown>>;
  /** A short name for the schema, for providers that ask for one (OpenRouter). */
  readonly schemaName: string;
}

/** A provider's raw answer. Adapters never parse, validate or retry it (ADR-0003). */
export interface GenerationResult {
  readonly text: string;
}

/**
 * What the prompt builder may use (AC15). It has no field for a name, an email or any section
 * text, so none can reach a provider.
 */
export interface PromptInput {
  /** The user's request, already plain text (API01). */
  readonly prompt: string;
  readonly scope: ProposalScope;
  /** The draft design to start from, or `null` when `basedOnCurrent` is false. */
  readonly current: DesignSpec | null;
  /** The section types the portfolio shows, in page order. */
  readonly visibleSections: readonly string[];
}

/** One reason a provider's answer cannot be used, sent back in the repair attempt. */
export interface AnswerIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * The parser's verdict on a provider's answer (AC3, AC4, AC5). `CONTRAST_FAILED` means the
 * answer was well-formed and only contrast pairs failed; anything else is `INVALID_OUTPUT`.
 */
export type ParsedAnswer =
  | { readonly ok: true; readonly design: DesignSpec; readonly rationale: string | null }
  | {
      readonly ok: false;
      readonly code: Extract<ProposalFailureCode, 'INVALID_OUTPUT' | 'CONTRAST_FAILED'>;
      readonly issues: readonly AnswerIssue[];
    };

/** How a `pending` proposal ends (AC2, AC3, AC4, AC6, AC10). */
export type ProposalOutcome =
  | {
      readonly status: 'ready';
      readonly design: DesignSpec;
      readonly rationale: string | null;
      readonly durationMs: number;
      readonly completedAt: Date;
    }
  | {
      readonly status: 'failed';
      readonly failure: ProposalFailure;
      readonly durationMs: number;
      readonly completedAt: Date;
    };
