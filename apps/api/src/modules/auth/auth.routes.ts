/**
 * Router factory for the `auth` module, mounted under `/api/v1` by the app factory.
 * Documented in `openapi/openapi.yaml` as operations `owner-auth.API01`–`API04`.
 *
 * Order per route follows `architecture.md` → Request lifecycle: [limiter →] validate → guard →
 * controller. The login rate limiter and the Origin allow-list arrive with `owner-auth.T06`,
 * the password-reset routes (API05–API07) with `owner-auth.T08`.
 */
import { ApiRouter, validate } from '../../core/http/index.js';
import type { AuthController } from './auth.controller.js';
import type { IAuthGuard } from './auth.interface.js';
import { loginRequestSchema } from './auth.types.js';

/**
 * @param controller - The module's controller.
 * @param requireOwner - The session guard, for the one auth route that needs a signed-in owner.
 */
export function createAuthRouter(controller: AuthController, requireOwner: IAuthGuard): ApiRouter {
  return (
    new ApiRouter()
      .route('post', '/auth/login', validate(loginRequestSchema), controller.login)
      // Refresh and logout read the cookies themselves: refresh must accept an expired access
      // token, and logout must succeed with no valid cookies at all, so neither is guarded.
      .route('post', '/auth/refresh', controller.refresh)
      .route('post', '/auth/logout', controller.logout)
      .route('get', '/auth/me', requireOwner, controller.me)
  );
}
