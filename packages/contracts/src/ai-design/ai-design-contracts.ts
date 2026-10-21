/**
 * AI design proposals (`ai-design-studio` → Proposal, API Contract). The design inside a
 * proposal is a `DesignSpec` from `packages/design-tokens`, which this package does not depend
 * on; it is typed loosely here and validated in full by the API's design validator.
 */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';

export const PROPOSAL_STATUSES = ['pending', 'ready', 'failed', 'applied', 'discarded'] as const;
export const PROPOSAL_SCOPES = ['theme', 'layout', 'both'] as const;
export const AI_PROVIDER_IDS = ['gemini', 'openrouter', 'ollama', 'stub'] as const;
export const PROPOSAL_FAILURE_CODES = [
  'PROVIDER_TIMEOUT',
  'PROVIDER_ERROR',
  'INVALID_OUTPUT',
  'CONTRAST_FAILED',
  'INTERRUPTED',
] as const;

/** Failures that are the platform's or the provider's fault: they give their charge back (AC17). */
export const REFUNDABLE_FAILURES: readonly ProposalFailureCode[] = ['PROVIDER_TIMEOUT', 'PROVIDER_ERROR', 'INTERRUPTED'];

/** Longest prompt (`ai-design-studio.API01`). */
export const PROMPT_MAX_LENGTH = 600;
/** Longest stored rationale. */
export const RATIONALE_MAX_LENGTH = 400;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
export type ProposalScope = (typeof PROPOSAL_SCOPES)[number];
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];
export type ProposalFailureCode = (typeof PROPOSAL_FAILURE_CODES)[number];

/** `ai-design-studio.API01` — body. */
export const createProposalRequestSchema = z.object({
  prompt: plainText(PROMPT_MAX_LENGTH),
  scope: z.enum(PROPOSAL_SCOPES),
  basedOnCurrent: z.boolean().default(true),
  /** Ask for a new custom layout for every section in scope (`design-library.AC7`). */
  explore: z.boolean().default(false),
});

/** `ai-design-studio.API07` — body: save a proposal as a design preset (`design-library.AC8`). */
export const saveProposalPresetRequestSchema = z.object({ name: plainText(60) });
export type SaveProposalPresetRequest = z.infer<typeof saveProposalPresetRequestSchema>;

/** `ai-design-studio.API03` — query. The cursor is the last proposal id of the previous page. */
export const listProposalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().regex(/^[0-9a-f]{24}$/).optional(),
});

/** `ai-design-studio.API02`, `API04`, `API05` — params. */
export const proposalIdParamsSchema = z.object({ id: z.string().regex(/^[0-9a-f]{24}$/) });

/** `ai-design-studio.API04` — body. */
export const applyProposalRequestSchema = z.object({ expectedDesignRevision: z.number().int().min(0) });

export type CreateProposalRequest = z.infer<typeof createProposalRequestSchema>;
export type ListProposalsQuery = z.infer<typeof listProposalsQuerySchema>;
export type ApplyProposalRequest = z.infer<typeof applyProposalRequestSchema>;

/**
 * A design as a proposal carries it: theme tokens, one layout entry per section, and — when the
 * AI designed any — a custom layout per section (`design-library`; a `CustomLayout` each).
 */
export interface ProposedDesign {
  readonly theme: unknown;
  readonly layout: Readonly<Record<string, string>>;
  readonly customLayouts?: Readonly<Record<string, unknown>>;
}

/** What a proposal cost (AC17): nothing (the owner), a free slot, or credits. */
export interface ProposalCharge {
  readonly kind: 'none' | 'free' | 'credit';
  readonly credits: number;
  /** `true` once a refundable failure gave the charge back. */
  readonly refunded: boolean;
}

/** `ai-design-studio` → Proposal. */
export interface Proposal {
  readonly id: string;
  readonly status: ProposalStatus;
  readonly prompt: string;
  readonly scope: ProposalScope;
  readonly basedOnCurrent: boolean;
  /** Asked for new custom layouts (`design-library.AC7`). */
  readonly explore: boolean;
  readonly provider: AiProviderId;
  readonly model: string;
  readonly design: ProposedDesign | null;
  readonly rationale: string | null;
  readonly failure: { readonly code: ProposalFailureCode; readonly message: string } | null;
  readonly charge: ProposalCharge;
  readonly durationMs: number;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

/** The user's generation allowance (`ai-design-studio.API06`, AC17, AC18). */
export interface GenerationAllowance {
  readonly unlimited: boolean;
  readonly freeMonthly: number;
  readonly freeUsed: number;
  readonly creditCost: number;
  /** `null` for the owner. */
  readonly balance: number | null;
  /** When the free allowance starts again: the next month's first instant, UTC. */
  readonly resetsAt: string;
}

/** `ai-design-studio.API06` — data. */
export interface AiProviderInfo {
  readonly provider: AiProviderId;
  readonly model: string;
  readonly isStub: boolean;
  readonly reachable: boolean;
  readonly allowance: GenerationAllowance;
}
