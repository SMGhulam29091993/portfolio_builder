/**
 * `IAuthService` — sign-in, refresh, sign-out and the current user (`owner-auth.T04`;
 * `owner-auth.API01`–`API04`; spec → Session contract, Refresh).
 *
 * Business rules only: the service never sees `req`, `res` or a cookie header. It takes the
 * cookie values the controller read and returns the tokens the cookie writer sets
 * (`owner-auth.T05`). Clearing cookies on a 401 is likewise the HTTP layer's job.
 *
 * Every `jti` check goes through the injected `ISessionAuthorizer`, so this class holds no copy
 * of that rule. It is also the `ISessionStarter` registration signs a verified user in with
 * (`account-registration.T02`), so a session is minted in exactly one place.
 */
import { sha256Hex } from '../../core/crypto/sha256.js';
import { UnauthenticatedError } from '../../core/errors/index.js';
import { EmailNotVerifiedError, SessionExpiredError } from './auth.errors.js';
import type {
  IAuthService,
  ISessionStarter,
  IClock,
  IPasswordHasher,
  ISecureRandom,
  ISessionAuthorizer,
  ISessionStore,
  ITokenIssuer,
  IUserReader,
} from './auth.interface.js';
import type {
  AuthorizedSession,
  AuthSession,
  AuthUser,
  LoginRequest,
  SessionCookies,
  SignedInSession,
  User,
} from './auth.types.js';

/** Refresh-token length: 256 random bits (spec → Session contract). */
const REFRESH_TOKEN_BYTES = 32;

/** `jti` length: 128 random bits (spec → Session contract). */
const JTI_BYTES = 16;

/** Length of the random password behind the decoy hash; it is never used for anything else. */
const DECOY_PASSWORD_BYTES = 32;

/** One message for an unknown email and a wrong password, so neither can be told apart. */
const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';

/** A freshly minted session: what is stored, and the raw tokens for the cookies. */
interface MintedSession {
  readonly session: AuthSession;
  readonly tokens: SignedInSession['tokens'];
}

export class AuthService implements IAuthService, ISessionStarter {
  /**
   * A real hash of a random password, verified against when the email is unknown so sign-in
   * does the same work either way (`owner-auth.AC2`). Made on first need and reused; only that
   * first unknown-email sign-in after a restart also pays for one hash.
   */
  private decoyHash?: Promise<string>;

  constructor(
    private readonly users: IUserReader,
    private readonly sessions: ISessionStore,
    private readonly authorizer: ISessionAuthorizer,
    private readonly passwords: IPasswordHasher,
    private readonly tokens: ITokenIssuer,
    private readonly random: ISecureRandom,
    private readonly clock: IClock,
  ) {}

  async login({ email, password }: LoginRequest): Promise<SignedInSession> {
    const user = await this.users.findByEmail(email);
    // Verify even when there is no user, against the decoy, so the response time does not
    // reveal whether the email exists.
    const hash = user?.passwordHash ?? (await this.getDecoyHash());
    const matches = await this.passwords.verify(hash, password);
    if (!user || !matches) throw new UnauthenticatedError(INVALID_CREDENTIALS_MESSAGE);
    // Only after the password matched, so the 403 tells nothing to anyone without it
    // (`account-registration.AC9`).
    if (!user.emailVerifiedAt) throw new EmailNotVerifiedError();

    return this.startFor(user);
  }

  async startFor(user: User): Promise<SignedInSession> {
    const minted = await this.mint(user.id);
    // Unconditional: one session per user, so this sign-in ends any other browser's
    // (`owner-auth.AC7`).
    await this.sessions.replace(user.id, minted.session);
    return { user: toAuthUser(user), tokens: minted.tokens };
  }

  async refresh({ accessToken, jti, refreshToken }: SessionCookies): Promise<SignedInSession> {
    // Steps 1–3 of spec → Refresh: signature only, then the session, then the `jti` match.
    const { userId, session } = await this.authorizer.authorize(
      { accessToken, jti },
      { ignoreExpiry: true },
    );

    // Step 4 — a genuine `jti` with a wrong refresh token means a cookie was forged or stolen:
    // end the session so the stolen half is useless too (`owner-auth.AC9`). Conditional on the
    // `jti`, so it deletes exactly the session that was presented. Comparing SHA-256 digests
    // of a 256-bit token leaks nothing usable through timing.
    if (!refreshToken || sha256Hex(refreshToken) !== session.refreshTokenHash) {
      await this.sessions.deleteIfJti(userId, session.jti);
      throw new UnauthenticatedError();
    }

    const user = await this.users.findById(userId);
    if (!user) throw new UnauthenticatedError();

    // Step 5 — rotate. The token is signed before the swap, so a signing failure cannot leave
    // a rotated session whose tokens the browser never received.
    const minted = await this.mint(userId);
    const swapped = await this.sessions.compareAndSet(userId, session.jti, minted.session);
    // Another refresh with the same cookies won the race (`owner-auth.AC10`). No grace window:
    // the loser is told its session ended, and nothing is deleted — the winner's session stays.
    if (!swapped) throw new SessionExpiredError();

    return { user: toAuthUser(user), tokens: minted.tokens };
  }

  async logout({ accessToken, jti }: SessionCookies): Promise<void> {
    let authorized: AuthorizedSession;
    try {
      authorized = await this.authorizer.authorize({ accessToken, jti }, { ignoreExpiry: true });
    } catch (error) {
      // No, invalid or superseded cookies: there is nothing this browser may end, and sign-out
      // still succeeds (API03 is idempotent). Anything else — the store being down — is a real
      // failure and must not be reported as a sign-out.
      if (error instanceof UnauthenticatedError || error instanceof SessionExpiredError) return;
      throw error;
    }
    // Conditional on the `jti`, so a refresh or sign-in that lands in between is not undone.
    await this.sessions.deleteIfJti(authorized.userId, authorized.session.jti);
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthenticatedError();
    return toAuthUser(user);
  }

  /** A new `jti`, refresh token and access token, and the session record that holds them. */
  private async mint(userId: string): Promise<MintedSession> {
    const jti = this.random.base64url(JTI_BYTES);
    const refreshToken = this.random.base64url(REFRESH_TOKEN_BYTES);
    const accessToken = await this.tokens.signAccessToken({ userId, jti });
    return {
      // Only the digest of the refresh token is stored (spec → Session contract).
      session: { jti, refreshTokenHash: sha256Hex(refreshToken), issuedAt: this.clock.now() },
      tokens: { accessToken, refreshToken, jti },
    };
  }

  /** The decoy hash, made once. A failed attempt is forgotten so the next sign-in retries it. */
  private getDecoyHash(): Promise<string> {
    this.decoyHash ??= this.passwords
      .hash(this.random.base64url(DECOY_PASSWORD_BYTES))
      .catch((error: unknown) => {
        this.decoyHash = undefined;
        throw error;
      });
    return this.decoyHash;
  }
}

/** The user as responses show it: no password hash, no timestamps. */
function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role };
}
