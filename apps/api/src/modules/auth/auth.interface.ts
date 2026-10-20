/**
 * Contracts of the `auth` module. Each interface is owned here, on the consuming side
 * (`constitution.md` → SOLID, Dependency Inversion), and is role-sized (Interface Segregation):
 * the services that arrive in `owner-auth.T04` and `T08` and the seeder in `T09` each depend
 * only on the methods they call.
 *
 * `owner-auth.T02` defined the persistence ports, `T03` the hashing, token, randomness and
 * clock ports, `T04` the session-authorizer and auth-service ports, `T05` the two HTTP-layer
 * ports at the end of this file, `T07` the mail port and `T08` the password-reset service
 * port.
 *
 * Only the HTTP-layer ports mention Express types; no service imports them.
 */
import type { Request, RequestHandler, Response } from 'express';

import type {
  AccessTokenClaims,
  AuthorizedSession,
  AuthSession,
  AuthUser,
  ForgotPasswordRequest,
  LoginRequest,
  MailMessage,
  NewUser,
  OtpIssue,
  OtpIssuedResponse,
  OAuthState,
  OtpRecord,
  PendingUserUpdate,
  RegisterRequest,
  RegistrationOptionsResponse,
  ResendOtpRequest,
  ResetPasswordRequest,
  SessionCookies,
  SessionCredentials,
  SessionTokens,
  SignedInSession,
  User,
  UserRole,
  VerificationCodeRequest,
  VerificationResendRequest,
  VerifyEmailRequest,
} from './auth.types.js';

/** Looks users up. Used by sign-in, refresh, `me` and the password-reset request. */
export interface IUserReader {
  /** Finds a user by email, compared case-insensitively. */
  findByEmail(email: string): Promise<User | null>;
  /** Finds a user by id; `null` for an unknown or malformed id. */
  findById(id: string): Promise<User | null>;
}

/** Creates users. Used by registration (`account-registration`) and the development seeder. */
export interface IUserCreator {
  /**
   * @throws {ConflictError} `USER_EXISTS` when a user with the same email already exists;
   *   `OWNER_EXISTS` when `role` is `owner` and an owner already exists.
   */
  create(user: NewUser): Promise<User>;
}

/**
 * The writes registration and verification make to an existing account
 * (`account-registration.T01`).
 */
export interface IUserRegistrar {
  /**
   * Replaces the password hash and display name (and the role, when given) of an account whose
   * email is **not yet verified** (`account-registration.AC3`). Conditional in one update, so a
   * verification landing in between is never overwritten.
   *
   * @returns The updated user, or `null` when no unverified account has this id.
   * @throws {ConflictError} `OWNER_EXISTS` when `role` is `owner` and another owner exists.
   */
  updatePending(id: string, update: PendingUserUpdate): Promise<User | null>;
  /**
   * Sets `emailVerifiedAt` when it is unset; an already-verified account keeps its first date.
   *
   * @returns `false` when no user has this id.
   */
  markEmailVerified(id: string, at: Date): Promise<boolean>;
}

/** The Google link on `users` (`google-sign-in` → Resolving the user). */
export interface IGoogleLinker {
  /** The user linked to this Google subject id. */
  findByGoogleSub(sub: string): Promise<User | null>;
  /**
   * Links the Google subject to an account that has no link yet, and sets `emailVerifiedAt`
   * when it is unset — Google reported the email verified (`google-sign-in.AC3`).
   *
   * @returns `false` when no user has this id or it is already linked (to any subject).
   */
  linkGoogle(id: string, sub: string, verifiedAt: Date): Promise<boolean>;
}

/**
 * The Google flow's state between its two requests (`google-sign-in` → Flow; ADR-0008: Redis
 * for the `auth` module only).
 */
export interface IOAuthStateStore {
  /** Stores `value` under `state` with the store's TTL. */
  put(state: string, value: OAuthState): Promise<void>;
  /** Returns and deletes the value in one step, so a callback can never be replayed. */
  take(state: string): Promise<OAuthState | null>;
}

/** What the authorization redirect carries (`google-sign-in` → Flow, step 1). */
export interface OidcAuthorizationRequest {
  readonly state: string;
  readonly nonce: string;
  /** `BASE64URL(SHA-256(code_verifier))` — PKCE S256. */
  readonly codeChallenge: string;
}

/** The verified identity an ID token carried (`google-sign-in` → Flow, step 4). */
export interface OidcIdentity {
  /** The issuer's stable subject id. */
  readonly sub: string;
  /** Lower-cased. */
  readonly email: string;
  /** Whether the issuer reports the email as verified. */
  readonly emailVerified: boolean;
  /** The display name claim, when present. Untrusted text: cleaned before it is stored. */
  readonly name?: string;
}

/**
 * The OpenID Connect provider — Google (ADR-0011). Chosen by the container from configuration:
 * `OidcProvider` when configured, `DisabledOidcProvider` otherwise. No provider-specific type or
 * error crosses this port.
 */
export interface IOidcProvider {
  /** `false` for the disabled provider; read by the registration options (`googleSignIn`). */
  isEnabled(): boolean;
  /**
   * The authorization endpoint URL with every parameter of the flow.
   *
   * @throws {ServiceUnavailableError} Not configured (503).
   * @throws {UpstreamError} The issuer's discovery document could not be read (`provider: "google"`).
   */
  authorizationUrl(request: OidcAuthorizationRequest): Promise<string>;
  /**
   * Exchanges the code (with the PKCE verifier) and verifies the ID token: signature against
   * the issuer's keys, `iss`, `aud`, expiry and `nonce`.
   *
   * @throws {ServiceUnavailableError} Not configured (503).
   * @throws {UpstreamError} The exchange failed or the ID token did not verify (`provider: "google"`).
   */
  exchange(code: string, codeVerifier: string, expectedNonce: string): Promise<OidcIdentity>;
}

/** The redirect that starts a Google sign-in, and the state its cookie must carry. */
export interface GoogleSignInStart {
  readonly redirectUrl: string;
  readonly state: string;
}

/** What the callback hands the service. */
export interface GoogleCallback {
  /** Google's `error` parameter, when it sent one (the user cancelled). */
  readonly error?: string;
  readonly code?: string;
  readonly state?: string;
  /** The `google-state` cookie the browser carried. */
  readonly cookieState?: string;
}

/** Google sign-in (`google-sign-in.API01`, `API02`). */
export interface IGoogleSignInService {
  /**
   * Mints `state`, the PKCE verifier and the nonce, stores them and builds the redirect.
   *
   * @throws {GoogleSignInError} `google_unavailable` or `google_failed`.
   */
  start(): Promise<GoogleSignInStart>;
  /**
   * Checks the state, exchanges the code, resolves the user and starts their session.
   *
   * @throws {GoogleSignInError} With the reason the redirect carries.
   */
  complete(callback: GoogleCallback): Promise<SignedInSession>;
}

/** Reads, writes and clears the `google-state` cookie (`google-sign-in` → API01). */
export interface IOAuthStateCookie {
  read(req: Request): string | undefined;
  write(res: Response, state: string): void;
  clear(res: Response): void;
}

/** Whether the owner slot is taken (`account-registration` → Roles and the owner claim). */
export interface IOwnerLookup {
  ownerExists(): Promise<boolean>;
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

/**
 * Sends one plain-text email (ADR-0009). The strategy behind it — Gmail today — is picked by
 * `MailSenderFactory` from configuration, so the password reset never knows which provider
 * delivers its code.
 */
export interface IMailSender {
  /**
   * Resolves when a send could be attempted; contacts no provider. The password reset calls it
   * before any other work, so with mail disabled API05 and API06 answer 503 for every address
   * and write nothing (`owner-auth.AC22`) — a decoy for an unknown address, which never sends,
   * would otherwise still answer 200.
   *
   * @throws {ServiceUnavailableError} No mail strategy is configured outside production (503).
   */
  ensureAvailable(): Promise<void>;
  /**
   * Hands the message to the provider; resolves once the provider has accepted it.
   *
   * @throws {UpstreamError} The provider refused or could not be reached (`provider: "mail"`,
   *   502). No provider-specific error type crosses this port.
   * @throws {ServiceUnavailableError} No mail strategy is configured outside production (503).
   */
  send(message: MailMessage): Promise<void>;
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
 * Starts the one session a user may hold, exactly as a sign-in does (three new values, the
 * Redis session replaced). Implemented by `AuthService`, whose `login` uses it, so a verified
 * registration signs in through the same code path (`account-registration.AC7`).
 */
export interface ISessionStarter {
  startFor(user: User): Promise<SignedInSession>;
}

/** The owner claim rule (`account-registration` spec → Roles and the owner claim). */
export interface IOwnerClaimPolicy {
  /** `true` while no owner exists and a secret is configured. */
  isOpen(): Promise<boolean>;
  /**
   * The role a registration gets: `member` when no secret was given; `owner` when the claim is
   * open and the secret matches.
   *
   * @throws {OwnerClaimRefusedError} A secret was given and the claim is closed or it differs.
   */
  decide(ownerSecret: string | undefined): Promise<UserRole>;
}

/**
 * Registration and email verification (`account-registration.API01`–`API05`). Business rules
 * only; the controller sets the cookies of the session `verify` starts.
 */
export interface IRegistrationService {
  options(): Promise<RegistrationOptionsResponse>;
  /**
   * Creates or refreshes an unverified account and emails a code; a decoy for a verified
   * address (`account-registration.AC1`–`AC5`).
   *
   * @throws {OwnerClaimRefusedError} The owner secret was refused (403).
   * @throws {ConflictError} `OWNER_EXISTS` — the claim lost a race (409).
   * @throws {UpstreamError} The mail provider refused the send (502).
   * @throws {ServiceUnavailableError} Mail disabled outside production, or Redis down (503).
   */
  register(request: RegisterRequest): Promise<OtpIssuedResponse>;
  /**
   * Proves the email and signs the user in (`account-registration.AC7`, `AC8`).
   *
   * @throws {OtpInvalidError} Unknown reference, wrong purpose, attempts used up or wrong code.
   * @throws {OtpExpiredError} The code has expired.
   */
  verify(request: VerifyEmailRequest): Promise<SignedInSession>;
  /** A fresh code for an unverified address; a decoy otherwise (`account-registration.AC10`). */
  requestCode(request: VerificationCodeRequest): Promise<OtpIssuedResponse>;
  /**
   * Replaces the code a reference names (`account-registration.AC11`).
   *
   * @throws {OtpInvalidError} The reference names no verification code, or the account is
   *   already verified.
   * @throws {RateLimitedError} Less than 60 seconds since the last send.
   */
  resend(request: VerificationResendRequest): Promise<OtpIssuedResponse>;
}

/**
 * Password reset by one-time code (`owner-auth.API05`–`API07`; spec → Password reset by
 * one-time code). Business rules only: the controller passes validated bodies in and turns the
 * results into the envelope.
 */
export interface IPasswordResetService {
  /**
   * Issues a code for the owner and emails it. For any other address, returns a decoy
   * reference made the same way and writes and sends nothing, so the answer is the same
   * (`owner-auth.AC16`, `AC17`).
   *
   * @throws {UpstreamError} The mail provider refused the send (502).
   * @throws {ServiceUnavailableError} Mail is disabled outside production, or Redis is down.
   */
  requestCode(request: ForgotPasswordRequest): Promise<OtpIssuedResponse>;
  /**
   * Replaces the code a reference names with a fresh code, identifier and reference, and
   * emails it (`owner-auth.AC21`). The old reference and the old code stop working.
   *
   * @throws {OtpInvalidError} The reference resolves to no document.
   * @throws {RateLimitedError} Less than 60 seconds since the code was sent.
   * @throws {UpstreamError} The mail provider refused the send (502).
   * @throws {ServiceUnavailableError} Mail is disabled outside production, or Redis is down.
   */
  resend(request: ResendOtpRequest): Promise<OtpIssuedResponse>;
  /**
   * Checks the code and sets the new password; then deletes the code, its reference and the
   * owner's session, so every browser must sign in again (`owner-auth.AC18`).
   *
   * @throws {OtpInvalidError} Unknown reference, no document, attempts used up or wrong code.
   * @throws {OtpExpiredError} The code's `expiresAt` has passed (`owner-auth.AC20`).
   */
  reset(request: ResetPasswordRequest): Promise<void>;
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
