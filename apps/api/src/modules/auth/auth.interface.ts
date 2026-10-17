/**
 * Contracts of the `auth` module. Each interface is owned here, on the consuming side
 * (`constitution.md` → SOLID, Dependency Inversion), and is role-sized (Interface Segregation):
 * the services that arrive in `owner-auth.T04` and `T08` and the seeder in `T09` each depend
 * only on the methods they call.
 *
 * `owner-auth.T02` defined the persistence ports, `T03` the hashing, token, randomness and
 * clock ports, `T04` the session-authorizer and auth-service ports, and `T05` the two HTTP-layer
 * ports at the end of this file. The password-reset service port follows with `T08`.
 *
 * Only the HTTP-layer ports mention Express types; no service imports them.
 */
import type { Request, RequestHandler, Response } from 'express';

import type {
  AccessTokenClaims,
  AuthorizedSession,
  AuthSession,
  AuthUser,
  LoginRequest,
  NewUser,
  OtpIssue,
  OtpRecord,
  SessionCookies,
  SessionCredentials,
  SessionTokens,
  SignedInSession,
  User,
} from './auth.types.js';

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

/** Slow, salted password hashing — argon2id (ADR-0007). */
export interface IPasswordHasher {
  /** Hashes a password with a fresh salt; two calls on one password give different hashes. */
  hash(password: string): Promise<string>;
  /**
   * `true` when `password` matches `hash`. Takes the same time for a wrong password as for a
   * right one, so sign-in can run it for an unknown email too (`owner-auth.AC2`).
   *
   * @throws {Error} When `hash` is not a hash this hasher produced.
   */
  verify(hash: string, password: string): Promise<boolean>;
}

/**
 * Salted hashing for one-time codes and their references — bcrypt (ADR-0007). Kept apart from
 * `IPasswordHasher` because the inputs, algorithm and cost differ.
 */
export interface IOtpHasher {
  /** Hashes `value` with a fresh salt. */
  hash(value: string): Promise<string>;
  /** `true` when `value` matches `hash`; `false` for a mismatch or a malformed hash. */
  compare(value: string, hash: string): Promise<boolean>;
}

/** What signing an access token needs; `iat` and `exp` come from the issuer's clock. */
export interface AccessTokenSubject {
  readonly userId: string;
  readonly jti: string;
}

/** Options for verifying an access token. */
export interface VerifyAccessTokenOptions {
  /**
   * Accept an expired token whose signature is valid. Used by refresh and logout only, which
   * must read the session an expired token names (spec → Refresh); never by the guard.
   */
  readonly ignoreExpiry?: boolean;
}

/** Signs and verifies access tokens (JWT, HS256, signed with `JWT_ACCESS_SECRET`). */
export interface ITokenIssuer {
  /** A signed token with the claims `sub`, `jti`, `iat` and `exp` (`iat` + 15 minutes). */
  signAccessToken(subject: AccessTokenSubject): Promise<string>;
  /**
   * The token's claims, or `null` when it is malformed, tampered, signed with another secret
   * or algorithm, carries other claims, or — unless `ignoreExpiry` — has expired beyond the
   * 30-second leeway. Never throws for a bad token.
   */
  verifyAccessToken(
    token: string,
    options?: VerifyAccessTokenOptions,
  ): Promise<AccessTokenClaims | null>;
}

/** Cryptographically secure randomness, injectable so tests are deterministic. */
export interface ISecureRandom {
  /** `byteLength` random bytes, base64url without padding (refresh tokens, `jti`). */
  base64url(byteLength: number): string;
  /** `byteLength` random bytes as lower-case hex (one-time-code identifiers). */
  hex(byteLength: number): string;
  /** A uniformly random string of `length` decimal digits, leading zeros kept (codes). */
  numericCode(length: number): string;
}

/** The current time, injectable so expiry, cooldown and TTL tests are deterministic. */
export interface IClock {
  now(): Date;
}

/** Options for `ISessionAuthorizer.authorize`. */
export interface AuthorizeOptions {
  /**
   * Accept an access token past its expiry when its signature is valid. Refresh and logout
   * only (spec → Refresh, API03); the guard never sets it.
   */
  readonly ignoreExpiry?: boolean;
}

/**
 * The one implementation of the `jti` triple match (spec → Request authorization, steps 1–3),
 * shared by the guard, refresh and logout so the rule cannot drift between them.
 */
export interface ISessionAuthorizer {
  /**
   * Verifies the access token, loads the session its `sub` names and checks that the token's
   * `jti`, the `jti` cookie and the session's `jti` are equal. Never writes to the store.
   *
   * @throws {UnauthenticatedError} No or invalid access token, or no session for its `sub`.
   * @throws {SessionExpiredError} The three `jti` values are not all equal.
   */
  authorize(credentials: SessionCredentials, options?: AuthorizeOptions): Promise<AuthorizedSession>;
}

/** Sign-in, refresh, sign-out and the current user (`owner-auth.API01`–`API04`). */
export interface IAuthService {
  /**
   * Checks the credentials and starts the user's one session, replacing any previous one.
   *
   * @throws {UnauthenticatedError} Unknown email or wrong password — one error for both.
   */
  login(credentials: LoginRequest): Promise<SignedInSession>;
  /**
   * Rotates the `jti`, access token and refresh token of the session the cookies name.
   *
   * @throws {UnauthenticatedError} No valid token, no session, or a wrong refresh token (the
   *   session is then deleted).
   * @throws {SessionExpiredError} A `jti` mismatch, or another refresh rotated the session
   *   first.
   */
  refresh(cookies: SessionCookies): Promise<SignedInSession>;
  /**
   * Ends the session the cookies name, when they still name the current one. Never throws for
   * missing, invalid or superseded cookies, so sign-out is idempotent.
   */
  logout(cookies: SessionCookies): Promise<void>;
  /**
   * The signed-in user, for a request the guard already authorised.
   *
   * @throws {UnauthenticatedError} The user no longer exists.
   */
  me(userId: string): Promise<AuthUser>;
}

/**
 * The only reader and writer of the three session cookies (`owner-auth` plan → Architecture
 * Approach), used by the controller and the guard. Names, paths, lifetime and the `Secure` /
 * `SameSite` flags live in its implementation, so no other class can set them differently.
 */
export interface ISessionCookieWriter {
  /** The session cookies the request carried; a missing or unreadable cookie is `undefined`. */
  read(req: Request): SessionCookies;
  /** Sets all three cookies to a freshly minted session (sign-in, refresh). */
  write(res: Response, tokens: SessionTokens): void;
  /** Clears all three cookies, on the same paths they were set on. */
  clear(res: Response): void;
}

/**
 * `requireOwner` — the guard every `/api/v1/cms/**` route runs (spec → Request authorization).
 * Other modules receive the instance from the container and import only this type
 * (`owner-auth` plan → Architecture Approach). After it, `req.auth` is set.
 */
export type IAuthGuard = RequestHandler;
