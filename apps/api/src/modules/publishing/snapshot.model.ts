/**
 * Mongoose schema of `snapshots` (`publish-pipeline` plan → Data Model; ADR-0004). Imported by
 * `SnapshotRepository` only.
 *
 * Indexes carry the rules:
 * - `{ portfolioId, version }` unique — versions stay unique under racing publishes (AC16);
 * - `{ portfolioId, publishedAt: -1 }` — the history, newest first;
 * - `{ 'content.assets.id': 1 }` — "is this asset in any snapshot?" (AC18).
 */
import { Schema, type Connection, type Model, type Types } from 'mongoose';

export interface SnapshotDocument {
  portfolioId: Types.ObjectId;
  version: number;
  contentHash: string;
  /** `PublishedContent`, validated and hashed before it got here. Never updated. */
  content: unknown;
  note: string | null;
  publishedAt: Date;
  publishedBy: Types.ObjectId;
  delivery: { status: 'ok' | 'failed' | 'pending'; at: Date | null; attempts: number };
}

const snapshotSchema = new Schema<SnapshotDocument>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    version: { type: Number, required: true, min: 1 },
    contentHash: { type: String, required: true },
    content: { type: Schema.Types.Mixed, required: true },
    note: { type: String, default: null },
    publishedAt: { type: Date, required: true },
    publishedBy: { type: Schema.Types.ObjectId, required: true },
    delivery: {
      status: { type: String, enum: ['ok', 'failed', 'pending'], required: true, default: 'pending' },
      at: { type: Date, default: null },
      attempts: { type: Number, required: true, default: 0 },
    },
  },
  // `minimize: false` keeps empty objects and arrays inside `content` as hashed.
  { collection: 'snapshots', strict: 'throw', minimize: false },
);

snapshotSchema.index({ portfolioId: 1, version: 1 }, { unique: true });
snapshotSchema.index({ portfolioId: 1, publishedAt: -1 });
snapshotSchema.index({ 'content.assets.id': 1 });

const MODEL_NAME = 'Snapshot';

export function snapshotModel(connection: Connection): Model<SnapshotDocument> {
  return (
    (connection.models[MODEL_NAME] as Model<SnapshotDocument> | undefined) ??
    connection.model<SnapshotDocument>(MODEL_NAME, snapshotSchema)
  );
}
