/**
 * `requireOwner` — the guard on every `/api/v1/cms/**` route and on `GET /api/v1/auth/me`
 * (`owner-auth.T05`; spec → Request authorization; `owner-auth.AC4`–`AC7`).
 *
 * HTTP only: it reads the two cookies the check needs, hands them to `ISessionAuthorizer` — the
 * one implementation of steps 1–3, shared with refresh and sign-out — and on success sets
 * `req.auth` (step 4). It holds no copy of the rule itself.
 *
 * Cookies are cleared on `SESSION_EXPIRED` only (step 3): that browser was superseded and its
 * cookies can never work again. On `UNAUTHENTICATED` they are kept, because the usual cause is
 * an access token past its 15 minutes, which the client repairs with a refresh — and refresh
 * needs those cookies. A 503 from an unreachable Redis keeps them too.
 *
 * Express 5 forwards the rejection to the error middleware, so the controller never runs on a
 * failed check.
 */
import { SessionExpiredError } from './auth.errors.js';
import type { IAuthGuard, ISessionAuthorizer, ISessionCookieWriter } from './auth.interface.js';

export class RequireOwnerMiddleware {
  constructor(
    private readonly authorizer: ISessionAuthorizer,
    private readonly cookies: ISessionCookieWriter,
  ) {}

  /** The guard itself; an arrow function so it can be passed to a router unbound. */
  readonly handle: IAuthGuard = async (req, res, next) => {
    // The refresh-token cookie is scoped to `/api/v1/auth` and never reaches `/cms`; the guard
    // does not need it — step 2 checks the stored session that token belongs to.
    const { accessToken, jti } = this.cookies.read(req);

    try {
      const { userId } = await this.authorizer.authorize({ accessToken, jti });
      req.auth = { userId };
    } catch (error) {
      if (error instanceof SessionExpiredError) this.cookies.clear(res);
      throw error;
    }

    next();
  };
}
