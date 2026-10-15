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

import type { Env } from './config/env.js';
import type { IMongoConnectionProvider } from './core/db/database-connection.interface.js';
import { RateLimiterFactory, type ApiRouter, type RateLimitPolicy } from './core/http/index.js';
import type { ILogger } from './core/logger/logger.interface.js';
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

/** What the container needs from the startup sequence. */
export interface ContainerDependencies {
  /** Validated configuration; consumed by later modules (auth, AI, publishing). */
  readonly env: Env;
  readonly logger: ILogger;
  readonly mongo: IMongoConnectionProvider;
}

/** What the app factory needs from the container. */
export interface Container {
  readonly logger: ILogger;
  /** Module routers, each mounted under `/api/v1` in this order. */
  readonly apiRouters: readonly ApiRouter[];
}

/** Wires every module. Performs no I/O beyond reading the API's own `package.json`. */
export function buildContainer({ logger, mongo }: ContainerDependencies): Container {
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

  return { logger, apiRouters: [healthRouter] };
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
