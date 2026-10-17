/**
 * Contracts of the `auth` module. Each interface is owned here, on the consuming side
 * (`constitution.md` → SOLID, Dependency Inversion), and is role-sized (Interface Segregation):
 * the services that arrive in `owner-auth.T04` and `T08` and the seeder in `T09` each depend
 * only on the methods they call.
 *
 * `owner-auth.T02` defines the persistence ports. Service, hasher and token ports follow with
 * the tasks that introduce them.
 */
import type { AuthSession, NewUser, OtpIssue, OtpRecord, User } from './auth.types.js';

/** Looks users up. Used by sign-in, refresh, `me` and the password-reset request. */
export interface IUserReader {
  /** Finds a user by email, compared case-insensitively. */
  findByEmail(email: string): Promise<User | null>;
  /** Finds a user by id; `null` for an unknown or malformed id. */
  findById(id: string): Promise<User | null>;
}

/** Creates users. Used by the owner seeder only — there is no sign-up. */
export interface IUserCreator {
  /**
   * @throws {ConflictError} When a user with the same email already exists.
   */
  create(user: NewUser): Promise<User>;
}

/** Replaces a password hash. Used by the password reset only. */
export interface IUserPasswordWriter {
  /**
   * Sets `passwordHash` and `passwordChangedAt`.
   *
   * @returns `false` when no user has this id.
   */
  updatePassword(id: string, passwordHash: string, changedAt: Date): Promise<boolean>;
}

/** The `otps` collection: one one-time code per `(userId, purpose)`. */
export interface IOtpRepository {
  /**
   * Creates or overwrites the document for `(issue.userId, issue.purpose)` and resets
   * `attempts` to 0. A previous identifier stops resolving, which invalidates its reference.
   */
  upsert(issue: OtpIssue): Promise<OtpRecord>;
  /** Finds the document holding this identifier. */
  findByIdentifier(identifier: string): Promise<OtpRecord | null>;
  /**
   * Adds one wrong attempt atomically.
   *
   * @returns The attempt count after the increment, or `null` when the document is gone.
   */
  incrementAttempts(id: string): Promise<number | null>;
  /** Deletes the document; a missing one is not an error. */
  deleteById(id: string): Promise<void>;
}

/**
 * The single Redis session per user (ADR-0008). Every write is atomic, so two requests racing
 * on one session cannot both win.
 */
export interface ISessionStore {
  /** The user's session, or `null` when there is none or it expired. */
  get(userId: string): Promise<AuthSession | null>;
  /** Writes the session unconditionally (sign-in), replacing any previous one and its TTL. */
  replace(userId: string, session: AuthSession): Promise<void>;
  /**
   * Replaces the session only while the stored `jti` equals `expectedJti` (refresh rotation,
   * `owner-auth.AC10`), resetting the TTL.
   *
   * @returns `true` when the swap happened; `false` when there was no session or the `jti`
   *   had changed.
   */
  compareAndSet(userId: string, expectedJti: string, next: AuthSession): Promise<boolean>;
  /**
   * Deletes the session only while its `jti` equals `expectedJti`, so a superseded browser can
   * never end the newer session (`owner-auth.AC11`).
   *
   * @returns `true` when a session was deleted.
   */
  deleteIfJti(userId: string, expectedJti: string): Promise<boolean>;
  /** Deletes the session whatever its `jti` (password reset). A missing one is not an error. */
  delete(userId: string): Promise<void>;
}

/** Maps a one-time-code reference to its identifier in Redis (ADR-0008). */
export interface IOtpReferenceStore {
  /** Stores the mapping with the store's TTL, overwriting an existing one. */
  put(reference: string, identifier: string): Promise<void>;
  /** The identifier, or `null` when the reference is unknown or expired. */
  resolve(reference: string): Promise<string | null>;
  /** Removes the mapping; a missing one is not an error. */
  delete(reference: string): Promise<void>;
}
