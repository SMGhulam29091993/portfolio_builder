/**
 * MongoDB access for `otps` (`owner-auth.T02`; spec → Password reset by one-time code).
 * Queries only — the code is hashed, compared and expired by `PasswordResetService`
 * (`owner-auth.T08`). Returns plain domain objects, never Mongoose documents.
 */
import { isValidObjectId, Types } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import type { IOtpRepository } from './auth.interface.js';
import type { OtpIssue, OtpRecord } from './auth.types.js';
import { otpModel, type OtpDocument } from './otp.model.js';

/** A lean `otps` document as the driver returns it. */
type LeanOtp = OtpDocument & { _id: Types.ObjectId };

export class OtpRepository implements IOtpRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async upsert(issue: OtpIssue): Promise<OtpRecord> {
    // One atomic `findOneAndUpdate` on the unique `{ userId, purpose }` key: a first send
    // inserts, a resend or a repeated request overwrites — never two documents for one user.
    const userId = new Types.ObjectId(issue.userId);
    const stored = await this.model()
      .findOneAndUpdate(
        { userId, purpose: issue.purpose },
        {
          // Repeated in `$setOnInsert` on purpose: update validators only check update paths,
          // so a key that came from the filter alone would be inserted unvalidated (an unknown
          // `purpose` would slip past the schema's enum).
          $setOnInsert: { userId, purpose: issue.purpose },
          $set: {
            identifier: issue.identifier,
            otpHash: issue.otpHash,
            attempts: 0,
            sentAt: issue.sentAt,
            expiresAt: issue.expiresAt,
            purgeAt: issue.purgeAt,
          },
        },
        { upsert: true, returnDocument: 'after', runValidators: true },
      )
      .lean<LeanOtp>()
      .exec();
    // With `upsert` and `returnDocument: 'after'` the driver always returns the document.
    return toOtpRecord(stored);
  }

  async findByIdentifier(identifier: string): Promise<OtpRecord | null> {
    const found = await this.model().findOne({ identifier }).lean<LeanOtp>().exec();
    return found ? toOtpRecord(found) : null;
  }

  async incrementAttempts(id: string): Promise<number | null> {
    if (!isValidObjectId(id)) return null;
    // `$inc` on the server, so two wrong codes submitted together both count.
    const updated = await this.model()
      .findOneAndUpdate({ _id: id }, { $inc: { attempts: 1 } }, { returnDocument: 'after' })
      .lean<LeanOtp>()
      .exec();
    return updated ? updated.attempts : null;
  }

  async deleteById(id: string): Promise<void> {
    if (!isValidObjectId(id)) return;
    await this.model().deleteOne({ _id: id }).exec();
  }

  /** Resolved per call, so the repository can be built before the connection opens. */
  private model() {
    return otpModel(this.connections.getConnection());
  }
}

/** Maps a stored document to the domain type, dropping Mongoose's `_id`, `__v` and timestamps. */
function toOtpRecord(document: LeanOtp): OtpRecord {
  return {
    id: document._id.toString(),
    userId: document.userId.toString(),
    purpose: document.purpose,
    identifier: document.identifier,
    otpHash: document.otpHash,
    attempts: document.attempts,
    sentAt: document.sentAt,
    expiresAt: document.expiresAt,
    purgeAt: document.purgeAt,
  };
}
