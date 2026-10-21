/**
 * MongoDB access for `users` (`owner-auth.T02`; registration writes from
 * `account-registration.T01`). Queries only: no hashing, no validation beyond the schema, no
 * business rules (`constitution.md` → Layer responsibilities). Returns plain domain objects,
 * never Mongoose documents.
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type {
  IGoogleLinker,
  IOwnerLookup,
  IUserCreator,
  IUserPasswordWriter,
  IUserReader,
  IUserRegistrar,
} from './auth.interface.js';
import type { NewUser, PendingUserUpdate, User } from './auth.types.js';
import { userModel, type UserDocument } from './user.model.js';

/** MongoDB's duplicate-key error code. */
const DUPLICATE_KEY = 11_000;

/** A lean `users` document as the driver returns it. */
type LeanUser = UserDocument & { _id: { toString(): string } };

export class UserRepository
  implements
    IUserReader,
    IUserCreator,
    IUserPasswordWriter,
    IUserRegistrar,
    IOwnerLookup,
    IGoogleLinker
{
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async findByEmail(email: string): Promise<User | null> {
    // Lower-cased here as well as by the contract schema, so no caller can miss the match on
    // case alone (spec → Edge Cases).
    const found = await this.model()
      .findOne({ email: email.toLowerCase() })
      .lean<LeanUser>()
      .exec();
    return found ? toUser(found) : null;
  }

  async findById(id: string): Promise<User | null> {
    // An id that is not an ObjectId cannot match; answer `null` instead of a cast error.
    if (!isValidObjectId(id)) return null;
    const found = await this.model().findById(id).lean<LeanUser>().exec();
    return found ? toUser(found) : null;
  }

  async create(user: NewUser): Promise<User> {
    try {
      const created = await this.model().create(user);
      return toUser(created.toObject());
    } catch (error) {
      throw toConflict(error) ?? error;
    }
  }

  async updatePassword(id: string, passwordHash: string, changedAt: Date): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const result = await this.model()
      .updateOne({ _id: id }, { $set: { passwordHash, passwordChangedAt: changedAt } })
      .exec();
    return result.matchedCount === 1;
  }

  async updatePending(id: string, update: PendingUserUpdate): Promise<User | null> {
    if (!isValidObjectId(id)) return null;
    try {
      // The filter carries the "still unverified" rule, so the check and the write are one
      // atomic step (`account-registration.AC3`).
      const updated = await this.model()
        .findOneAndUpdate(
          { _id: id, emailVerifiedAt: { $exists: false } },
          { $set: update },
          { new: true, runValidators: true },
        )
        .lean<LeanUser>()
        .exec();
      return updated ? toUser(updated) : null;
    } catch (error) {
      throw toConflict(error) ?? error;
    }
  }

  async markEmailVerified(id: string, at: Date): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    // Set only when unset, so the first verification date survives. A miss means either no
    // such user or one already verified; only the first answers `false`.
    const result = await this.model()
      .updateOne({ _id: id, emailVerifiedAt: { $exists: false } }, { $set: { emailVerifiedAt: at } })
      .exec();
    if (result.matchedCount === 1) return true;
    return (await this.model().exists({ _id: id }).exec()) !== null;
  }

  async findByGoogleSub(sub: string): Promise<User | null> {
    const found = await this.model().findOne({ googleSub: sub }).lean<LeanUser>().exec();
    return found ? toUser(found) : null;
  }

  async linkGoogle(id: string, sub: string, verifiedAt: Date): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    try {
      // Conditional on "no link yet", so an existing link is never replaced (`google-sign-in.AC8`).
      const linked = await this.model()
        .findOneAndUpdate(
          { _id: id, googleSub: { $exists: false } },
          { $set: { googleSub: sub } },
          { new: true },
        )
        .lean<LeanUser>()
        .exec();
      if (!linked) return false;
      if (!linked.emailVerifiedAt) {
        await this.model()
          .updateOne({ _id: id, emailVerifiedAt: { $exists: false } }, { $set: { emailVerifiedAt: verifiedAt } })
          .exec();
      }
      return true;
    } catch (error) {
      // Another account holds this subject already: not linkable.
      if (toConflict(error)) return false;
      throw error;
    }
  }

  async ownerExists(): Promise<boolean> {
    return (await this.model().exists({ role: 'owner' }).exec()) !== null;
  }

  /** Resolved per call, so the repository can be built before the connection opens. */
  private model() {
    return userModel(this.connections.getConnection());
  }
}

/** Maps a stored document to the domain type, dropping Mongoose's `_id` and `__v`. */
function toUser(document: LeanUser): User {
  return {
    id: document._id.toString(),
    email: document.email,
    ...(document.passwordHash ? { passwordHash: document.passwordHash } : {}),
    displayName: document.displayName,
    // Documents from before `account-registration` carry no role: they are members.
    role: document.role ?? 'member',
    ...(document.emailVerifiedAt ? { emailVerifiedAt: document.emailVerifiedAt } : {}),
    ...(document.googleSub ? { googleSub: document.googleSub } : {}),
    ...(document.passwordChangedAt ? { passwordChangedAt: document.passwordChangedAt } : {}),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/**
 * The conflict a duplicate-key error stands for, or `null` for any other error: the
 * `one_owner` index means a second owner (`OWNER_EXISTS`), the email index a taken address
 * (`USER_EXISTS`). Read without importing the driver's error class.
 */
function toConflict(error: unknown): ConflictError | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  if (error.code !== DUPLICATE_KEY) return null;
  const keyPattern = 'keyPattern' in error ? (error.keyPattern as Record<string, unknown>) : {};
  if ('role' in keyPattern) {
    return new ConflictError('OWNER_EXISTS', {}, 'The platform owner has already been claimed');
  }
  return new ConflictError('USER_EXISTS', {}, 'A user with this email already exists');
}
