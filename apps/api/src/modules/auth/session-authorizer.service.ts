/**
 * `ISessionAuthorizer` — the `jti` triple match (`owner-auth.T04`; spec → Request
 * authorization, steps 1–3).
 *
 * The one place the rule lives. The guard (`owner-auth.T05`) calls it as is; refresh and
 * sign-out call it with `ignoreExpiry`, so all three agree on what a live session is
 * (`owner-auth` plan → Architecture Approach). It only reads the session store: a mismatch
 * leaves the session in place, because it belongs to the newer sign-in that superseded this
 * browser (`owner-auth.AC6`).
 */
import { UnauthenticatedError } from '../../core/errors/index.js';
import { SessionExpiredError } from './auth.errors.js';
import type {
  AuthorizeOptions,
  ISessionAuthorizer,
  ISessionStore,
  ITokenIssuer,
} from './auth.interface.js';
import type { AuthorizedSession, SessionCredentials } from './auth.types.js';

export class SessionAuthorizer implements ISessionAuthorizer {
  constructor(
    private readonly tokens: ITokenIssuer,
    private readonly sessions: ISessionStore,
  ) {}

  async authorize(
    { accessToken, jti }: SessionCredentials,
    { ignoreExpiry = false }: AuthorizeOptions = {},
  ): Promise<AuthorizedSession> {
    // Step 1 — the access token: absent, malformed, tampered, wrong-secret or expired (unless
    // ignored) all read as "not signed in", with no hint of which.
    if (!accessToken) throw new UnauthenticatedError();
    const claims = await this.tokens.verifyAccessToken(accessToken, { ignoreExpiry });
    if (!claims) throw new UnauthenticatedError();

    // Step 2 — the session the token names; gone after sign-out, expiry or a password reset.
    const session = await this.sessions.get(claims.sub);
    if (!session) throw new UnauthenticatedError();

    // Step 3 — token, cookie and session must name the same `jti`. Only reached with a genuine
    // token, so SESSION_EXPIRED reveals nothing to a caller who lacks one. A missing cookie is
    // a mismatch like any other.
    if (claims.jti !== jti || claims.jti !== session.jti) throw new SessionExpiredError();

    return { userId: claims.sub, session };
  }
}
