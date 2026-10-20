/**
 * Composition root — the only place services, repositories, adapters and controllers are
 * instantiated (`constitution.md` → Composition root). Every dependency is passed through a
 * constructor here; no class looks anything up for itself.
 *
 * Called by `main.ts` once MongoDB has answered, and by the OpenAPI drift check (which builds the
 * route table without connecting).
 */
import type { RequestHandler } from 'express';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

import { API_PREFIX } from './app.js';
import type { Env } from './config/env.js';
import type { IMongoConnectionProvider } from './core/db/database-connection.interface.js';
import {
  OriginAllowListMiddleware,
  RateLimiterFactory,
  type ApiRouter,
  type RateLimitPolicy,
} from './core/http/index.js';
import type { ILogger } from './core/logger/logger.interface.js';
import type { IRedisClientProvider } from './core/redis/redis-client-provider.interface.js';
import { Argon2PasswordHasher } from './modules/auth/adapters/argon2-password-hasher.js';
import { BcryptOtpHasher } from './modules/auth/adapters/bcrypt-otp-hasher.js';
import { CryptoSecureRandom } from './modules/auth/adapters/crypto-secure-random.js';
import { DisabledMailSender } from './modules/auth/adapters/disabled-mail-sender.js';
import { GmailMailSender } from './modules/auth/adapters/gmail-mail-sender.js';
import { SmtpMailSender, smtpUrlSettings } from './modules/auth/adapters/smtp-mail-sender.js';
import { JwtTokenIssuer } from './modules/auth/adapters/jwt-token-issuer.js';
import { DisabledOidcProvider, OidcProvider } from './modules/auth/adapters/oidc-provider.js';
import {
  MailSenderFactory,
  type MailStrategy,
} from './modules/auth/adapters/mail-sender.factory.js';
import { SystemClock } from './modules/auth/adapters/system-clock.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { createAuthRouter, loginAttemptKey } from './modules/auth/auth.routes.js';
import { AuthService } from './modules/auth/auth.service.js';
import { GoogleAuthController } from './modules/auth/google-auth.controller.js';
import { createGoogleAuthRouter } from './modules/auth/google-auth.routes.js';
import { GoogleSignInService } from './modules/auth/google-sign-in.service.js';
import type { IAuthGuard, IClock, IMailSender, IOidcProvider } from './modules/auth/index.js';
import { OAuthStateCookie } from './modules/auth/oauth-state-cookie.js';
import { RedisOAuthStateStore } from './modules/auth/oauth-state.store.js';
import { RedisOtpReferenceStore } from './modules/auth/otp-reference.store.js';
import { OtpRepository } from './modules/auth/otp.repository.js';
import { OwnerClaimPolicy } from './modules/auth/owner-claim.policy.js';
import { PasswordResetService } from './modules/auth/password-reset.service.js';
import { RegistrationService } from './modules/auth/registration.service.js';
import { RequireOwnerMiddleware } from './modules/auth/require-owner.middleware.js';
import { SessionAuthorizer } from './modules/auth/session-authorizer.service.js';
import { SessionCookieWriter } from './modules/auth/session-cookie-writer.js';
import { RedisSessionStore } from './modules/auth/session.store.js';
import { UserRepository } from './modules/auth/user.repository.js';
import { MagicByteContentTypeDetector } from './modules/assets/adapters/magic-byte-content-type-detector.js';
import { AssetController } from './modules/assets/asset.controller.js';
import { AssetRepository } from './modules/assets/asset.repository.js';
import { createAssetRouter } from './modules/assets/asset.routes.js';
import { AssetService } from './modules/assets/asset.service.js';
import type { IAssetReferenceProvider, IFileStorage } from './modules/assets/index.js';
import { GridFsFileStorage } from './modules/assets/storage/gridfs-file-storage.js';
import { HealthController } from './modules/health/health.controller.js';
import { CryptoIdGenerator } from './modules/portfolio/adapters/crypto-id-generator.js';
import type { ISectionDefinition } from './modules/portfolio/index.js';
import { PortfolioController } from './modules/portfolio/portfolio.controller.js';
import { PortfolioProvisioner } from './modules/portfolio/portfolio.provisioner.js';
import { PortfolioRepository } from './modules/portfolio/portfolio.repository.js';
import { createPortfolioRouter } from './modules/portfolio/portfolio.routes.js';
import { ResolvePortfolioMiddleware } from './modules/portfolio/resolve-portfolio.middleware.js';
import { SectionRegistry } from './modules/portfolio/section.registry.js';
import { SectionRepository } from './modules/portfolio/section.repository.js';
import { SectionService } from './modules/portfolio/section.service.js';
import { HealthRepository } from './modules/health/health.repository.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { HealthService } from './modules/health/health.service.js';
import { REFERENCE_SECTIONS } from './seed/data/sections/index.js';
import { OwnerSeeder } from './seed/owner.seeder.js';
import { PortfolioSeeder } from './seed/portfolio.seeder.js';
import { SeedAll } from './seed/seed-all.seeder.js';
import { SectionSeeder } from './seed/section.seeder.js';
import type { ISeeder } from './seed/seeder.interface.js';

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

/**
 * Failed sign-ins allowed per client IP + email: 5 in 15 minutes; the sixth attempt is refused
 * even with the right password (`owner-auth.AC3`). Only a 401 counts as a failure, so a
 * successful sign-in, a malformed body (400) or a Redis outage (503) uses up nothing.
 */
const LOGIN_RATE_LIMIT: RateLimitPolicy = {
  windowMs: 15 * 60 * 1_000,
  max: 5,
  keyOf: loginAttemptKey,
  counts: (status) => status === 401,
};

/**
 * Code sends allowed per client IP on every route that emails a code (`owner-auth.API05`,
 * `API06`; `account-registration.API02`, `API04`, `API05`) together: 5 per hour (spec →
 * Password reset: send limit; `account-registration.AC14`). Every admitted request counts, whatever its outcome, so a decoy answer
 * for an unknown address costs the same as a real send and malformed bodies cannot be used to
 * probe for free.
 */
const CODE_SEND_RATE_LIMIT: RateLimitPolicy = { windowMs: 60 * 60 * 1_000, max: 5 };

/**
 * Lifetime of a one-time-code reference in Redis: 24 hours, so an expired code can still be
 * resent by its reference (`owner-auth` spec → Password reset, Edge Cases).
 */
const OTP_REFERENCE_TTL_SEC = 24 * 60 * 60;

/** Lifetime of a Google sign-in's stored state and its cookie: 10 minutes (`google-sign-in`). */
const GOOGLE_STATE_TTL_SEC = 10 * 60;

/** Google start + callback requests per client IP: 20 per 15 minutes (`google-sign-in` → API02). */
const GOOGLE_RATE_LIMIT: RateLimitPolicy = { windowMs: 15 * 60 * 1_000, max: 20 };

/**
 * Mounts whose non-GET requests must come from `WEB_ORIGIN` (`owner-auth.AC12`): the sign-in
 * flow and everything the CMS writes. `/health` and `/public` stay open to any caller.
 */
const ORIGIN_CHECKED_PATHS = [AUTH_PATH, `${API_PREFIX}/cms`] as const;

/**
 * Mail strategies in priority order (ADR-0009): the first whose variables are all set sends
 * every email. A new provider (Brevo) is one adapter class plus one entry placed ahead of Gmail;
 * the generic SMTP strategy (2026-10-20) already covers any provider with an SMTP relay.
 */
const MAIL_STRATEGIES: readonly MailStrategy[] = [
  // A generic SMTP server (a provider's relay; the E2E harness's local server). Needs its own
  // sender address, so `MAIL_FROM` is part of the strategy.
  MailSenderFactory.strategy(['SMTP_URL', 'MAIL_FROM'], ({ SMTP_URL, MAIL_FROM }) => {
    const { endpoint, credentials } = smtpUrlSettings(SMTP_URL);
    return new SmtpMailSender(endpoint, credentials, MAIL_FROM);
  }),
  MailSenderFactory.strategy(
    ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
    ({ GMAIL_USER, GMAIL_APP_PASSWORD }, { MAIL_FROM }) =>
      new GmailMailSender({
        user: GMAIL_USER,
        appPassword: GMAIL_APP_PASSWORD,
        from: MAIL_FROM ?? GMAIL_USER,
      }),
  ),
];

/**
 * The registered section types (`section-engine`; ADR-0005), in page order. Each section spec
 * adds its definition here — one line — and nothing else in the engine changes (AC10).
 */
const SECTION_DEFINITIONS: readonly ISectionDefinition[] = [];

/** What the container needs from the startup sequence. */
export interface ContainerDependencies {
  /** Validated configuration; consumed by later modules (auth, AI, publishing). */
  readonly env: Env;
  readonly logger: ILogger;
  readonly mongo: IMongoConnectionProvider;
  /** The Redis client for the `auth` session store (ADR-0008); used per command, not here. */
  readonly redis: IRedisClientProvider;
  /**
   * Replaces the system clock for tokens, sessions, expiry and rate-limit windows. Tests pass a `ManualClock` to
   * reach a 15-minute expiry without waiting (`owner-auth.IT08`); production omits it.
   */
  readonly clock?: IClock;
  /**
   * Replaces the configured mail strategy. Tests pass a `RecordingMailSender` so a one-time
   * code can be read back without a provider (ADR-0009: no test sends real mail); production
   * omits it, and the factory then decides — failing startup when nothing is configured.
   */
  readonly mailSender?: IMailSender;
  /**
   * Replaces the configured Google provider. Production omits it; the container then picks
   * `OidcProvider` when the three Google variables are set, else `DisabledOidcProvider`.
   */
  readonly oidcProvider?: IOidcProvider;
  /**
   * Replaces the section definition list. The engine's route tests pass test-only definitions
   * so the engine is proven without the six real types; production omits it.
   */
  readonly sectionDefinitions?: readonly ISectionDefinition[];
  /** Test-only additions to the asset reference providers (`media-assets.IT08`). */
  readonly extraAssetReferenceProviders?: readonly IAssetReferenceProvider[];
  /** Replaces GridFS; production omits it. */
  readonly fileStorage?: IFileStorage;
}

/** Middleware the app factory mounts on a set of path prefixes, ahead of every router. */
export interface MountedMiddleware {
  /** Full path prefixes, e.g. `/api/v1/auth`; Express matches each on segment boundaries. */
  readonly paths: readonly string[];
  readonly handler: RequestHandler;
}

/** What the app factory needs from the container. */
export interface Container {
  readonly logger: ILogger;
  /**
   * The Origin allow-list and the prefixes it guards (`owner-auth.AC12`). Mounted before the
   * routers so it answers 403 ahead of any limiter, validation or authentication.
   */
  readonly originAllowList: MountedMiddleware;
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
  mailSender,
  oidcProvider,
  sectionDefinitions = SECTION_DEFINITIONS,
  extraAssetReferenceProviders = [],
  fileStorage,
}: ContainerDependencies): Container {
  // On the same clock as tokens and sessions, so a test moves every window together.
  const rateLimiters = new RateLimiterFactory(() => clock.now().getTime());

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
  const users = new UserRepository(mongo);
  const passwordHasher = new Argon2PasswordHasher();
  const secureRandom = new CryptoSecureRandom();
  const sessionStore = new RedisSessionStore(redis, { ttlSec: SESSION_TTL_SEC });
  const sessionAuthorizer = new SessionAuthorizer(tokenIssuer, sessionStore);
  const authService = new AuthService(
    users,
    sessionStore,
    sessionAuthorizer,
    passwordHasher,
    tokenIssuer,
    secureRandom,
    clock,
  );

  // Mail (ADR-0009). The factory runs while the container is built, so production without a
  // mail strategy refuses to start (`owner-auth.AC22`); only a test's override skips it.
  const mail =
    mailSender ?? new MailSenderFactory(MAIL_STRATEGIES, new DisabledMailSender()).create(env);

  // Password reset by one-time code (`owner-auth.T08`).
  const otpRepository = new OtpRepository(mongo);
  const otpReferences = new RedisOtpReferenceStore(redis, { ttlSec: OTP_REFERENCE_TTL_SEC });
  const otpHasher = new BcryptOtpHasher();
  const passwordResetService = new PasswordResetService(
    users,
    users,
    otpRepository,
    otpReferences,
    otpHasher,
    passwordHasher,
    sessionStore,
    mail,
    secureRandom,
    clock,
    users,
  );
  // Google sign-in (`google-sign-in`, ADR-0011): on only when all three variables are set
  // (`env.ts` refuses a partial set).
  const google = oidcProvider ?? buildOidcProvider(env);

  // Registration and email verification (`account-registration`). Verification signs in
  // through `AuthService.startFor`, so sessions are minted in one place.
  const registrationService = new RegistrationService(
    users,
    users,
    users,
    otpRepository,
    otpReferences,
    otpHasher,
    passwordHasher,
    mail,
    secureRandom,
    clock,
    new OwnerClaimPolicy(users, { secret: env.OWNER_REGISTRATION_SECRET }),
    authService,
    google,
  );
  const sessionCookies = new SessionCookieWriter(env, {
    apiPath: API_PREFIX,
    authPath: AUTH_PATH,
    maxAgeSec: SESSION_TTL_SEC,
  });
  const authGuard = new RequireOwnerMiddleware(sessionAuthorizer, sessionCookies).handle;
  const authRouter = createAuthRouter(
    new AuthController(authService, sessionCookies, passwordResetService, registrationService),
    authGuard,
    {
      login: rateLimiters.create(LOGIN_RATE_LIMIT),
      codeSend: rateLimiters.create(CODE_SEND_RATE_LIMIT),
    },
  );

  const googleRouter = createGoogleAuthRouter(
    new GoogleAuthController(
      new GoogleSignInService(
        google,
        new RedisOAuthStateStore(redis, { ttlSec: GOOGLE_STATE_TTL_SEC }),
        users,
        users,
        users,
        authService,
        secureRandom,
        clock,
      ),
      sessionCookies,
      new OAuthStateCookie(env, { path: `${AUTH_PATH}/google`, maxAgeSec: GOOGLE_STATE_TTL_SEC }),
      { success: `${env.WEB_ORIGIN}/cms`, failure: `${env.WEB_ORIGIN}/cms/login` },
      logger,
    ),
    rateLimiters.create(GOOGLE_RATE_LIMIT),
  );

  // portfolio (`section-engine`): the registry is built here so a broken definition fails
  // startup (AC11). The user directory adapts `auth`'s reader, so `portfolio` imports nothing
  // from `auth` for the display name.
  const sectionRegistry = new SectionRegistry(sectionDefinitions);
  const portfolioRepository = new PortfolioRepository(mongo);
  const sectionRepository = new SectionRepository(mongo);
  const provisioner = new PortfolioProvisioner(portfolioRepository, sectionRepository, sectionRegistry, {
    displayNameOf: async (userId) => (await users.findById(userId))?.displayName ?? null,
  });
  const resolvePortfolio = new ResolvePortfolioMiddleware(provisioner).handle;
  const portfolioRouter = createPortfolioRouter(
    new PortfolioController(
      new SectionService(portfolioRepository, sectionRepository, sectionRegistry, new CryptoIdGenerator()),
      provisioner,
    ),
    authGuard,
    resolvePortfolio,
  );

  // assets (`media-assets`): bytes in GridFS; the reference providers are the modules that
  // store asset ids (identity, publishing), each added by its own spec.
  const assetReferenceProviders: IAssetReferenceProvider[] = [...extraAssetReferenceProviders];
  const assetService = new AssetService(
    new AssetRepository(mongo),
    fileStorage ?? new GridFsFileStorage(mongo),
    new MagicByteContentTypeDetector(),
    assetReferenceProviders,
  );
  const assetRouter = createAssetRouter(new AssetController(assetService), authGuard, resolvePortfolio);

  const originAllowList: MountedMiddleware = {
    paths: ORIGIN_CHECKED_PATHS,
    handler: new OriginAllowListMiddleware(env).handle,
  };

  return {
    logger,
    originAllowList,
    apiRouters: [healthRouter, authRouter, googleRouter, portfolioRouter, assetRouter],
    authGuard,
  };
}

/** What the seeders need: configuration and MongoDB — no Redis, mail or HTTP. */
export interface SeederDependencies {
  readonly env: Env;
  readonly mongo: IMongoConnectionProvider;
  /** Test-only replacements for the section definitions and the reference content. */
  readonly sectionDefinitions?: readonly ISectionDefinition[];
  readonly referenceContent?: Readonly<Record<string, unknown>>;
}

/** The seeders a script can run. */
export interface Seeders {
  /** The development-only account (`owner-auth.T09`); refuses in production (AC23). */
  readonly owner: ISeeder;
  /**
   * Every development seeder in order (`section-engine.T06`): account → portfolio → sections.
   * Later specs append their own steps here.
   */
  readonly all: SeedAll;
}

/**
 * Wires the seeders for the `seed:*` scripts. Kept apart from `buildContainer` so a seed run
 * builds no mail strategy, limiter or router — and so production's mail fail-fast cannot
 * pre-empt the seeder's own, clearer production refusal. Performs no I/O.
 */
export function buildSeeders({
  env,
  mongo,
  sectionDefinitions = SECTION_DEFINITIONS,
  referenceContent = REFERENCE_SECTIONS,
}: SeederDependencies): Seeders {
  const users = new UserRepository(mongo);
  const owner = new OwnerSeeder(
    users,
    users,
    new Argon2PasswordHasher(),
    env,
    users,
    users,
    new SystemClock(),
  );
  const registry = new SectionRegistry(sectionDefinitions);
  const portfolios = new PortfolioRepository(mongo);
  const all = new SeedAll([
    { name: 'owner', seeder: owner },
    { name: 'portfolio', seeder: new PortfolioSeeder(users, portfolios, registry, env) },
    {
      name: 'sections',
      seeder: new SectionSeeder(
        users,
        portfolios,
        new SectionRepository(mongo),
        registry,
        referenceContent,
        env,
      ),
    },
  ]);
  return { owner, all };
}

/** The configured Google provider, or the disabled one when the variables are unset. */
function buildOidcProvider(env: Env): IOidcProvider {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URL, GOOGLE_ISSUER } = env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URL) {
    return new DisabledOidcProvider();
  }
  return new OidcProvider({
    issuer: GOOGLE_ISSUER,
    clientId: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    redirectUrl: GOOGLE_REDIRECT_URL,
  });
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
