/**
 * Mongoose schema of `design_proposals` (`ai-design-studio` plan → Data Model). Imported by
 * `ProposalRepository` only.
 *
 * Indexes carry the rules:
 * - `{ portfolioId, createdAt: -1 }` — the history, newest first, and the monthly free count;
 * - `{ portfolioId }` unique where `status` is `pending` — one generation in flight per
 *   portfolio, so racing requests past the last free slot charge only once (AC7, IT14).
 */
import { Schema, type Connection, type Model, type Types } from 'mongoose';

import { AI_PROVIDER_IDS, PROPOSAL_FAILURE_CODES, PROPOSAL_SCOPES, PROPOSAL_STATUSES } from './ai-design.types.js';
import type { AiProviderId, ProposalFailureCode, ProposalScope, ProposalStatus } from './ai-design.types.js';

export interface ProposalDocument {
  portfolioId: Types.ObjectId;
  userId: Types.ObjectId;
  status: ProposalStatus;
  prompt: string;
  scope: ProposalScope;
  basedOnCurrent: boolean;
  /** Absent on proposals stored before `design-library`; lean reads do not apply the default. */
  explore?: boolean;
  provider: AiProviderId;
  model: string;
  /** A `DesignSpec` validated by `IDesignValidator` before it got here; `null` until `ready`. */
  design: unknown;
  rationale: string | null;
  failure: { code: ProposalFailureCode; message: string } | null;
  charge: { kind: 'none' | 'free' | 'credit'; credits: number; refunded: boolean };
  durationMs: number;
  createdAt: Date;
  completedAt: Date | null;
}

const proposalSchema = new Schema<ProposalDocument>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    status: { type: String, enum: PROPOSAL_STATUSES, required: true },
    prompt: { type: String, required: true },
    scope: { type: String, enum: PROPOSAL_SCOPES, required: true },
    basedOnCurrent: { type: Boolean, required: true },
    // Proposals stored before `design-library` have none; they were not explore requests.
    explore: { type: Boolean, required: true, default: false },
    provider: { type: String, enum: AI_PROVIDER_IDS, required: true },
    model: { type: String, required: true },
    design: { type: Schema.Types.Mixed, default: null },
    rationale: { type: String, default: null },
    failure: {
      type: new Schema(
        { code: { type: String, enum: PROPOSAL_FAILURE_CODES, required: true }, message: { type: String, required: true } },
        { _id: false, strict: 'throw' },
      ),
      default: null,
    },
    charge: {
      kind: { type: String, enum: ['none', 'free', 'credit'], required: true },
      credits: { type: Number, required: true, min: 0 },
      refunded: { type: Boolean, required: true, default: false },
    },
    durationMs: { type: Number, required: true, min: 0, default: 0 },
    // Set by the service from `IClock`, not by Mongoose timestamps, so the monthly count and the
    // tests follow the same clock.
    createdAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
  },
  // `minimize: false` keeps empty objects inside `design` as validated.
  { collection: 'design_proposals', strict: 'throw', minimize: false },
);

proposalSchema.index({ portfolioId: 1, createdAt: -1 });
proposalSchema.index({ portfolioId: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

const MODEL_NAME = 'DesignProposal';

export function proposalModel(connection: Connection): Model<ProposalDocument> {
  return (
    (connection.models[MODEL_NAME] as Model<ProposalDocument> | undefined) ??
    connection.model<ProposalDocument>(MODEL_NAME, proposalSchema)
  );
}
