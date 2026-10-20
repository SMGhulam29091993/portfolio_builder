/**
 * Mongoose schema of `designs` (`design-theme` plan → Data Model): one per portfolio. The design
 * was validated by `IDesignValidator` before it got here. Imported by `DesignRepository` only.
 */
import { Schema, type Connection, type Model, type Types } from 'mongoose';

export interface DesignDocument {
  portfolioId: Types.ObjectId;
  revision: number;
  theme: unknown;
  layout: unknown;
  createdAt: Date;
  updatedAt: Date;
}

const designSchema = new Schema<DesignDocument>(
  {
    portfolioId: { type: Schema.Types.ObjectId, required: true, unique: true },
    revision: { type: Number, required: true, min: 1, default: 1 },
    theme: { type: Schema.Types.Mixed, required: true },
    layout: { type: Schema.Types.Mixed, required: true },
  },
  { collection: 'designs', timestamps: true, strict: 'throw', minimize: false },
);

const MODEL_NAME = 'Design';

export function designModel(connection: Connection): Model<DesignDocument> {
  return (
    (connection.models[MODEL_NAME] as Model<DesignDocument> | undefined) ??
    connection.model<DesignDocument>(MODEL_NAME, designSchema)
  );
}
