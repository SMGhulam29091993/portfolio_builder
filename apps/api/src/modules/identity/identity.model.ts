/**
 * Mongoose schema of `identities` (`site-identity` plan → Data Model): one document per
 * portfolio (unique `portfolioId`). `data` was validated by the contract schema before it got
 * here. Imported by `IdentityRepository` only.
 */
import { Schema, type Connection, type Model, type Types } from 'mongoose';

export interface IdentityDocument {
  portfolioId: Types.ObjectId;
  revision: number;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const identitySchema = new Schema<IdentityDocument>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true, unique: true },
    revision: { type: Number, required: true, min: 1, default: 1 },
    data: { type: Schema.Types.Mixed, required: true },
  },
  { collection: 'identities', timestamps: true, strict: 'throw', minimize: false },
);

const MODEL_NAME = 'Identity';

export function identityModel(connection: Connection): Model<IdentityDocument> {
  return (
    (connection.models[MODEL_NAME] as Model<IdentityDocument> | undefined) ??
    connection.model<IdentityDocument>(MODEL_NAME, identitySchema)
  );
}
