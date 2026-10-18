/**
 * In-memory fake of `UserRepository`'s read, create and password-write ports, for service tests
 * (`constitution.md` → Per-layer convention: services get constructor-injected fakes).
 *
 * It passes the same contract suite as the MongoDB repository
 * (`modules/auth/user-repository.contract.spec.ts`, `owner-auth.CT10`), so a service test that
 * uses it proves what the real repository would do. `IUserPasswordWriter` joined with the
 * password reset (`owner-auth.T08`), the first service that writes a password.
 */
import { Types } from 'mongoose';

import { ConflictError } from '../../core/errors/index.js';
import type {
  IUserCreator,
  IUserPasswordWriter,
  IUserReader,
  NewUser,
  User,
} from '../../modules/auth/index.js';

export class InMemoryUserRepository implements IUserReader, IUserCreator, IUserPasswordWriter {
  /** Users by id. */
  private readonly users = new Map<string, User>();

  /** @param now - The timestamp source for `createdAt` / `updatedAt`. */
  constructor(private readonly now: () => Date = () => new Date()) {}

  findByEmail(email: string): Promise<User | null> {
    const wanted = email.toLowerCase();
    const found = [...this.users.values()].find((user) => user.email === wanted);
    return Promise.resolve(found ?? null);
  }

  findById(id: string): Promise<User | null> {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  async create(user: NewUser): Promise<User> {
    const email = user.email.toLowerCase();
    // Same rule as the unique index on `users.email`.
    if (await this.findByEmail(email)) {
      throw new ConflictError('USER_EXISTS', {}, 'A user with this email already exists');
    }
    const at = this.now();
    // An ObjectId string, so ids have the shape the real repository returns.
    const created: User = {
      id: new Types.ObjectId().toString(),
      email,
      passwordHash: user.passwordHash,
      displayName: user.displayName,
      createdAt: at,
      updatedAt: at,
    };
    this.users.set(created.id, created);
    return created;
  }

  updatePassword(id: string, passwordHash: string, changedAt: Date): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return Promise.resolve(false);
    // `updatedAt` moves as Mongoose timestamps move it on an update.
    this.users.set(id, {
      ...user,
      passwordHash,
      passwordChangedAt: changedAt,
      updatedAt: this.now(),
    });
    return Promise.resolve(true);
  }
}
