/**
 * MongoDB access for `users` (`owner-auth.T02`). Queries only: no hashing, no validation
 * beyond the schema, no business rules (`constitution.md` → Layer responsibilities). Returns
 * plain domain objects, never Mongoose documents.
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type { IUserCreator, IUserPasswordWriter, IUserReader } from './auth.interface.js';
import type { NewUser, User } from './auth.types.js';
import { userModel, type UserDocument } from './user.model.js';

/** MongoDB's duplicate-key error code. */
const DUPLICATE_KEY = 11_000;

/** A lean `users` document as the driver returns it. */
type LeanUser = UserDocument & { _id: { toString(): string } };

export class UserRepository implements IUserReader, IUserCreator, IUserPasswordWriter {
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
      if (isDuplicateKey(error)) {
        // The seeder checks first, so this is only a race between two seeder runs.
        throw new ConflictError('USER_EXISTS', {}, 'A user with this email already exists');
      }
      throw error;
    }
  }

  async updatePassword(id: string, passwordHash: string, changedAt: Date): Promise<boolean> {
    if (!isValidObjectId(id)) return false;
    const result = await this.model()
      .updateOne({ _id: id }, { $set: { passwordHash, passwordChangedAt: changedAt } })
      .exec();
    return result.matchedCount === 1;
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
    passwordHash: document.passwordHash,
    displayName: document.displayName,
    ...(document.passwordChangedAt ? { passwordChangedAt: document.passwordChangedAt } : {}),
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/** `true` for the driver's duplicate-key error, without importing the driver's error class. */
function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_KEY
  );
}
