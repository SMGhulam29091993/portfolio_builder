/**
 * `IGoogleSignInService` — sign-in and sign-up with Google (`google-sign-in.T03`; spec → Flow,
 * Resolving the user; ADR-0011).
 *
 * `start` mints the flow's three secrets — `state`, the PKCE verifier and the nonce — keeps the
 * verifier and nonce in Redis under `state`, and returns the authorization URL. `complete`
 * checks the browser's `state` cookie against the query, takes the stored values exactly once,
 * lets `IOidcProvider` exchange the code and verify the ID token, resolves the token to one
 * `users` record and starts that user's session through `ISessionStarter` — the same path a
 * password sign-in takes.
 *
 * Every failure is a `GoogleSignInError` with the reason the redirect carries. Nothing is
 * logged here: the code, state, verifier, nonce and email are secret or personal.
 */
import { cleanPlainText, DISPLAY_NAME_MAX_LENGTH } from '@portfolio/contracts';

import { pkceChallenge } from '../../core/crypto/pkce.js';
import { ServiceUnavailableError, UpstreamError } from '../../core/errors/index.js';
import { GoogleSignInError } from './auth.errors.js';
import type {
  GoogleCallback,
  GoogleSignInStart,
  IClock,
  IGoogleLinker,
  IGoogleSignInService,
  IOAuthStateStore,
  IOidcProvider,
  ISecureRandom,
  ISessionStarter,
  IUserCreator,
  IUserReader,
  OidcIdentity,
} from './auth.interface.js';
import type { SignedInSession, User } from './auth.types.js';

/** `state` and nonce: 128 random bits each. */
const STATE_BYTES = 16;

/** PKCE verifier: 256 random bits, 43 base64url characters (RFC 7636 allows 43–128). */
const VERIFIER_BYTES = 32;

export class GoogleSignInService implements IGoogleSignInService {
  constructor(
    private readonly provider: IOidcProvider,
    private readonly states: IOAuthStateStore,
    private readonly users: IUserReader,
    private readonly creator: IUserCreator,
    private readonly linker: IGoogleLinker,
    private readonly sessions: ISessionStarter,
    private readonly random: ISecureRandom,
    private readonly clock: IClock,
  ) {}

  async start(): Promise<GoogleSignInStart> {
    if (!this.provider.isEnabled()) throw new GoogleSignInError('google_unavailable');

    const state = this.random.base64url(STATE_BYTES);
    const nonce = this.random.base64url(STATE_BYTES);
    const codeVerifier = this.random.base64url(VERIFIER_BYTES);

    const redirectUrl = await this.failing('google_failed', async () => {
      await this.states.put(state, { codeVerifier, nonce });
      return this.provider.authorizationUrl({
        state,
        nonce,
        codeChallenge: pkceChallenge(codeVerifier),
      });
    });
    return { redirectUrl, state };
  }

  async complete({ error, code, state, cookieState }: GoogleCallback): Promise<SignedInSession> {
    if (!this.provider.isEnabled()) throw new GoogleSignInError('google_unavailable');
    // Google sends `error` (e.g. `access_denied`) when the user backs out.
    if (error !== undefined) throw new GoogleSignInError('google_cancelled');
    // The cookie binds the callback to the browser that started the flow (login CSRF).
    if (!state || !cookieState || state !== cookieState || !code) {
      throw new GoogleSignInError('google_state');
    }

    const stored = await this.failing('google_failed', () => this.states.take(state));
    // Expired, or already used by an earlier callback: never redeemable twice.
    if (!stored) throw new GoogleSignInError('google_state');

    const identity = await this.failing('google_failed', () =>
      this.provider.exchange(code, stored.codeVerifier, stored.nonce),
    );
    const user = await this.resolve(identity);
    return this.sessions.startFor(user);
  }

  /** Spec → Resolving the user, steps 1–4. */
  private async resolve(identity: OidcIdentity): Promise<User> {
    const linked = await this.linker.findByGoogleSub(identity.sub);
    if (linked) return linked;

    // Linking or creating trusts the email only when Google vouches for it.
    if (!identity.emailVerified) throw new GoogleSignInError('google_unverified');

    const existing = await this.users.findByEmail(identity.email);
    if (existing) {
      // Linked to another Google account already: never re-linked silently (AC8).
      if (existing.googleSub !== undefined) throw new GoogleSignInError('google_conflict');
      if (!(await this.linker.linkGoogle(existing.id, identity.sub, this.clock.now()))) {
        throw new GoogleSignInError('google_conflict');
      }
      return (await this.users.findById(existing.id)) ?? existing;
    }

    // A new account is always a member: Google never claims the owner (ADR-0011, AC12).
    return this.creator.create({
      email: identity.email,
      displayName: displayNameFor(identity),
      role: 'member',
      googleSub: identity.sub,
      emailVerifiedAt: this.clock.now(),
    });
  }

  /**
   * Runs `work`, turning a provider or datastore failure into `GoogleSignInError(reason)`; a
   * `GoogleSignInError` already thrown passes through unchanged.
   */
  private async failing<T>(reason: 'google_failed', work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (error instanceof GoogleSignInError) throw error;
      if (error instanceof UpstreamError || error instanceof ServiceUnavailableError) {
        throw new GoogleSignInError(reason);
      }
      throw error;
    }
  }
}

/**
 * The display name for a new account: the token's `name`, cleaned as every free-text field is
 * (`plainText`), else the email's local part; trimmed to the registration limit.
 */
function displayNameFor({ name, email }: OidcIdentity): string {
  const cleaned = cleanPlainText(name ?? '');
  const chosen = cleaned.length > 0 ? cleaned : cleanPlainText(email.split('@')[0] ?? '');
  return (chosen.length > 0 ? chosen : 'Member').slice(0, DISPLAY_NAME_MAX_LENGTH);
}
