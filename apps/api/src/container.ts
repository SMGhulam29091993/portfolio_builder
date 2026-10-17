/**
 * Composition root — the only place services, repositories, adapters and controllers are
 * instantiated (`constitution.md` → Composition root). Every dependency is passed through a
 * constructor here; no class looks anything up for itself.
 *
 * Called by `main.ts` once MongoDB has answered, and by the OpenAPI drift check (which builds the
 * route table without connecting).
 */
import { readFileSync } from 'node:fs';
import { z } from 'zod';

import { API_PREFIX } from './app.js';
import type { Env } from './config/env.js';
import type { IMongoConnectionProvider } from './core/db/database-connection.interface.js';
import { RateLimiterFactory, type ApiRouter, type RateLimitPolicy } from './core/http/index.js';
import type { ILogger } from './core/logger/logger.interface.js';
import type { IRedisClientProvider } from './core/redis/redis-client-provider.interface.js';
import { Argon2PasswordHasher } from './modules/auth/adapters/argon2-password-hasher.js';
import { CryptoSecureRandom } from './modules/auth/adapters/crypto-secure-random.js';
import { JwtTokenIssuer } from './modules/auth/adapters/jwt-token-issuer.js';
import { SystemClock } from './modules/auth/adapters/system-clock.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import type { IAuthGuard, IClock } from './modules/auth/index.js';
import { RequireOwnerMiddleware } from './modules/auth/require-owner.middleware.js';
import { SessionAuthorizer } from './modules/auth/session-authorizer.service.js';
import { SessionCookieWriter } from './modules/auth/session-cookie-writer.js';
import { RedisSessionStore } from './modules/auth/session.store.js';
import { UserRepository } from './modules/auth/user.repository.js';
import { HealthController } from './modules/health/health.controller.js';
import { HealthRepository } from './modules/health/health.repository.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { HealthService } from './modules/health/health.service.js';

/**
 * Upper bound on the health check's database ping (spec → Error Handling: the endpoint cannot
 * hang). A down database answers 503 within this bound; a healthy ping is far below it.
 */
const HEALTH_PING_TIMEOUT_MS = 1_000;

/**
 * Requests per client on `GET /api/v1/health`: enough for a readiness probe every second, low
 * enough that the endpoint cannot be used to hammer MongoDB with pings.
 */
const HEALTH_RATE_LIMIT: RateLimitPolicy = { windowMs: 60_000, max: 60 };

/**
 * Session lifetime, from the `owner-auth` spec → Session contract: the Redis session's TTL
 * (reset by every refresh) and the `Max-Age` of all three cookies, so they expire together.
 */
const SESSION_TTL_SEC = 7 * 24 * 60 * 60;

/** Access-token lifetime: 15 minutes (spec → Session contract). */
const ACCESS_TOKEN_TTL_SEC = 15 * 60;

/** Clock skew tolerated on the access token's `exp` (spec → Request authorization, step 1). */
const ACCESS_TOKEN_LEEWAY_SEC = 30;

/** Where the refresh-token cookie is sent: the auth routes only (spec → Session contract). */
const AUTH_PATH = `${API_PREFIX}/auth`;

/** What the container needs from the startup sequence. */
export interface ContainerDependencies {
  /** Validated configuration; consumed by later modules (auth, AI, publishing). */
  readonly env: Env;
  readonly logger: ILogger;
  readonly mongo: IMongoConnectionProvider;
  /** The Redis client for the `auth` session store (ADR-0008); used per command, not here. */
  readonly redis: IRedisClientProvider;
  /**
   * Replaces the system clock for tokens, sessions and expiry. Tests pass a `ManualClock` to
   * reach a 15-minute expiry without waiting (`owner-auth.IT08`); production omits it.
   */
  readonly clock?: IClock;
}

/** What the app factory needs from the container. */
export interface Container {
  readonly logger: ILogger;
  /** Module routers, each mounted under `/api/v1` in this order. */
  readonly apiRouters: readonly ApiRouter[];
  /**
   * `requireOwner`, the guard every `/cms` router receives (`owner-auth` plan → Architecture
   * Approach). Exposed so tests can put it in front of a probe route until the first `/cms`
   * module exists.
   */
  readonly authGuard: IAuthGuard;
}

/** Wires every module. Performs no I/O beyond reading the API's own `package.json`. */
export function buildContainer({
  env,
  logger,
  mongo,
  redis,
  clock = new SystemClock(),
}: ContainerDependencies): Container {
  const rateLimiters = new RateLimiterFactory();

  const healthService = new HealthService(new HealthRepository(mongo), {
    version: readApiVersion(),
    pingTimeoutMs: HEALTH_PING_TIMEOUT_MS,
    uptimeSec: () => Math.floor(process.uptime()),
  });
  const healthRouter = createHealthRouter(
    new HealthController(healthService),
    rateLimiters.create(HEALTH_RATE_LIMIT),
  );

  // auth (`owner-auth`): sign-in, the single Redis session and the guard.
  const tokenIssuer = new JwtTokenIssuer(
    {
      secret: env.JWT_ACCESS_SECRET,
      ttlSec: ACCESS_TOKEN_TTL_SEC,
      leewaySec: ACCESS_TOKEN_LEEWAY_SEC,
    },
    clock,
  );
  const sessionStore = new RedisSessionStore(redis, { ttlSec: SESSION_TTL_SEC });
  const sessionAuthorizer = new SessionAuthorizer(tokenIssuer, sessionStore);
  const authService = new AuthService(
    new UserRepository(mongo),
    sessionStore,
    sessionAuthorizer,
    new Argon2PasswordHasher(),
    tokenIssuer,
    new CryptoSecureRandom(),
    clock,
  );
  const sessionCookies = new SessionCookieWriter(env, {
    apiPath: API_PREFIX,
    authPath: AUTH_PATH,
    maxAgeSec: SESSION_TTL_SEC,
  });
  const authGuard = new RequireOwnerMiddleware(sessionAuthorizer, sessionCookies).handle;
  const authRouter = createAuthRouter(new AuthController(authService, sessionCookies), authGuard);

  return { logger, apiRouters: [healthRouter, authRouter], authGuard };
}

/**
 * Reads `version` from `apps/api/package.json`. The relative URL resolves the same from
 * `src/container.ts` (tsx) and `dist/container.js` (built), both one level below the package.
 */
function readApiVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  return z.object({ version: z.string().min(1) }).parse(manifest).version;
}
