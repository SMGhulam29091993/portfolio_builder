/**
 * In-memory fake of `UserRepository`'s ports, for service tests (`constitution.md` → Per-layer
 * convention: services get constructor-injected fakes).
 *
 * It passes the same contract suite as the MongoDB repository
 * (`modules/auth/user-repository.contract.spec.ts`, `owner-auth.CT10`), so a service test that
 * uses it proves what the real repository would do. `IUserPasswordWriter` joined with the
 * password reset (`owner-auth.T08`); `IUserRegistrar` and `IOwnerLookup`, with the one-owner
 * rule of the `one_owner` index, with `account-registration.T01`.
 */
import { Types } from 'mongoose';

import { ConflictError } from '../../core/errors/index.js';
import type {
  IOwnerLookup,
  IUserCreator,
  IUserPasswordWriter,
  IUserReader,
  IUserRegistrar,
  NewUser,
  PendingUserUpdate,
  User,
} from '../../modules/auth/index.js';

export class InMemoryUserRepository
  implements IUserReader, IUserCreator, IUserPasswordWriter, IUserRegistrar, IOwnerLookup
{
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
    const role = user.role ?? 'member';
    this.assertOwnerSlot(role);
    const at = this.now();
    // An ObjectId string, so ids have the shape the real repository returns.
    const created: User = {
      id: new Types.ObjectId().toString(),
      email,
      passwordHash: user.passwordHash,
      displayName: user.displayName,
      role,
      ...(user.emailVerifiedAt ? { emailVerifiedAt: user.emailVerifiedAt } : {}),
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

  // Async, so a refused owner slot rejects the promise as the real repository's does.
  // eslint-disable-next-line @typescript-eslint/require-await
  async updatePending(id: string, update: PendingUserUpdate): Promise<User | null> {
    const user = this.users.get(id);
    if (!user || user.emailVerifiedAt) return null;
    if (update.role && update.role !== user.role) this.assertOwnerSlot(update.role);
    const updated: User = { ...user, ...update, updatedAt: this.now() };
    this.users.set(id, updated);
    return updated;
  }

  markEmailVerified(id: string, at: Date): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return Promise.resolve(false);
    if (!user.emailVerifiedAt) {
      this.users.set(id, { ...user, emailVerifiedAt: at, updatedAt: this.now() });
    }
    return Promise.resolve(true);
  }

  ownerExists(): Promise<boolean> {
    return Promise.resolve([...this.users.values()].some((user) => user.role === 'owner'));
  }

  /** Same rule as the `one_owner` partial unique index. */
  private assertOwnerSlot(role: User['role']): void {
    if (role !== 'owner') return;
    if ([...this.users.values()].some((user) => user.role === 'owner')) {
      throw new ConflictError('OWNER_EXISTS', {}, 'The platform owner has already been claimed');
    }
  }
}
