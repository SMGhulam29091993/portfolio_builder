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
import type { DesignSpec } from '@portfolio/design-tokens';

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
