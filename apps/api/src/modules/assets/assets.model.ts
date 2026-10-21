/**
 * Mongoose schema of `assets` (`media-assets` plan → Data Model). Imported by `AssetRepository`
 * only. The unique `{ portfolioId, sha256, kind }` index makes duplicate uploads — even
 * parallel ones — end as one asset per portfolio (`media-assets.AC6`, Edge Cases).
 */
import { Schema, type Connection, type Model, type Types } from 'mongoose';

import { ASSET_KINDS, type AssetKind } from './assets.types.js';

export interface AssetDocument {
  portfolioId: Types.ObjectId;
  kind: AssetKind;
  filename: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  storageKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<AssetDocument>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true },
    kind: { type: String, required: true, enum: ASSET_KINDS },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true },
    storageKey: { type: String, required: true, unique: true },
  },
  { collection: 'assets', timestamps: true, strict: 'throw' },
);

assetSchema.index({ portfolioId: 1, kind: 1, createdAt: -1 });
assetSchema.index({ portfolioId: 1, sha256: 1, kind: 1 }, { unique: true });

const MODEL_NAME = 'Asset';

export function assetModel(connection: Connection): Model<AssetDocument> {
  return (
    (connection.models[MODEL_NAME] as Model<AssetDocument> | undefined) ??
    connection.model<AssetDocument>(MODEL_NAME, assetSchema)
  );
}
