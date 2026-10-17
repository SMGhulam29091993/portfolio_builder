/**
 * Mongoose schema of the `otps` collection (`owner-auth` spec → Password reset by one-time
 * code; plan → Data Model). Imported by `OtpRepository` and nothing else.
 *
 * Three indexes carry the rules:
 * - `{ userId, purpose }` unique — the upsert key, so a user holds one code per purpose;
 * - `identifier` unique — the lookup the Redis reference resolves to;
 * - `purgeAt` TTL with `expireAfterSeconds: 0` — MongoDB deletes a document 24 hours after its
 *   code was sent. `expiresAt` (10 minutes) is checked by the service instead, so an expired
 *   code's document survives long enough to be resent (`owner-auth.AC20`).
 */
import { Schema, type Connection, type Model, type Types } from 'mongoose';

import { OTP_PURPOSES, type OtpPurpose } from './auth.types.js';

/** The stored shape. `_id`, `createdAt` and `updatedAt` are added by Mongoose. */
export interface OtpDocument {
  userId: Types.ObjectId;
  purpose: OtpPurpose;
  identifier: string;
  otpHash: string;
  attempts: number;
  sentAt: Date;
  expiresAt: Date;
  purgeAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpSchema = new Schema<OtpDocument>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    purpose: { type: String, required: true, enum: OTP_PURPOSES },
    identifier: { type: String, required: true, unique: true },
    otpHash: { type: String, required: true },
    attempts: { type: Number, required: true, default: 0, min: 0 },
    sentAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    purgeAt: { type: Date, required: true, expires: 0 },
  },
  { collection: 'otps', timestamps: true, strict: 'throw' },
);

otpSchema.index({ userId: 1, purpose: 1 }, { unique: true });

/** Name the model is registered under on a connection. */
const MODEL_NAME = 'Otp';

/** The `otps` model on `connection`, compiled on first use and reused after. */
export function otpModel(connection: Connection): Model<OtpDocument> {
  return (
    (connection.models[MODEL_NAME] as Model<OtpDocument> | undefined) ??
    connection.model<OtpDocument>(MODEL_NAME, otpSchema)
  );
}
