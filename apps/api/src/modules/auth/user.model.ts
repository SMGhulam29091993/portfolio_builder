/**
 * Mongoose schema of the `users` collection (`owner-auth` plan → Data Model; `role` and
 * `emailVerifiedAt` from `account-registration.T01`). Imported by
 * `UserRepository` and nothing else (`int-standards.express.md` → Per-module file pattern).
 *
 * Models are compiled on the API's own connection, never on the global `mongoose` default, so
 * the `MongoConnection` singleton stays the only pool (`constitution.md` → Infrastructure).
 */
import { Schema, type Connection, type Model } from 'mongoose';

import { USER_ROLES, type UserRole } from './auth.types.js';

/** The stored shape. `_id`, `createdAt` and `updatedAt` are added by Mongoose. */
export interface UserDocument {
  email: string;
  passwordHash: string;
  displayName: string;
  /** Absent on documents written before `account-registration`; read as `member`. */
  role?: UserRole;
  emailVerifiedAt?: Date;
  passwordChangedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    // Unique and lower-cased: sign-in compares emails case-insensitively (spec → Edge Cases),
    // and `lowercase` keeps that true even for a write that skipped the contract schema.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    displayName: { type: String, required: true },
    role: { type: String, enum: USER_ROLES, default: 'member' },
    emailVerifiedAt: { type: Date },
    passwordChangedAt: { type: Date },
  },
  { collection: 'users', timestamps: true, strict: 'throw' },
);

// At most one owner, ever at a time (ADR-0010): the database itself refuses a second one when
// two claims race (`account-registration.AC6`). Partial, so any number of members coexist.
userSchema.index(
  { role: 1 },
  { unique: true, partialFilterExpression: { role: 'owner' }, name: 'one_owner' },
);

/** Name the model is registered under on a connection. */
const MODEL_NAME = 'User';

/**
 * The `users` model on `connection`, compiled on first use and reused after. Compiling starts
 * the index build (`autoIndex`), so the unique email index exists before the first write lands.
 */
export function userModel(connection: Connection): Model<UserDocument> {
  return (
    (connection.models[MODEL_NAME] as Model<UserDocument> | undefined) ??
    connection.model<UserDocument>(MODEL_NAME, userSchema)
  );
}
