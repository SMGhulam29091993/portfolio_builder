/**
 * Router factory for the `health` module, mounted under `/api/v1` by the app factory.
 * Documented in `openapi/openapi.yaml` as operation `monorepo-foundation.API01`.
 */
import type { RequestHandler } from 'express';

import { ApiRouter } from '../../core/http/index.js';
import type { HealthController } from './health.controller.js';

/**
 * @param controller - The module's controller.
 * @param rateLimiter - Limiter for this mount, built by the container's `RateLimiterFactory`.
 */
export function createHealthRouter(
  controller: HealthController,
  rateLimiter: RequestHandler,
): ApiRouter {
  return new ApiRouter().route('get', '/health', rateLimiter, controller.get);
}
