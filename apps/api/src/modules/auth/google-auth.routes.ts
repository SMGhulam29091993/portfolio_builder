/**
 * Router factory for Google sign-in, mounted under `/api/v1` by the app factory
 * (`google-sign-in.T03`). Documented in `openapi/openapi.yaml` as `google-sign-in.API01` and
 * `API02`. Both are GETs (browser navigations), so the Origin allow-list does not apply; the
 * callback is protected by the state cookie and the single-use stored state instead.
 */
import type { RequestHandler } from 'express';

import { ApiRouter } from '../../core/http/index.js';
import type { GoogleAuthController } from './google-auth.controller.js';

/**
 * @param controller - The Google controller.
 * @param limiter - One limiter on both routes (20 per 15 minutes per IP), so the start route
 *   cannot be used to fill Redis with states.
 */
export function createGoogleAuthRouter(
  controller: GoogleAuthController,
  limiter: RequestHandler,
): ApiRouter {
  return new ApiRouter()
    .route('get', '/auth/google/start', limiter, controller.start)
    .route('get', '/auth/google/callback', limiter, controller.callback);
}
