/**
 * Router factory for the identity, mounted under `/api/v1` (`site-identity.T04`). Documented as
 * `site-identity.API01`–`API02`. Both run `requireOwner` then `resolvePortfolio`.
 */
import type { RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { IdentityController } from './identity.controller.js';
import { updateIdentityRequestSchema } from './identity.types.js';

export function createIdentityRouter(
  controller: IdentityController,
  requireOwner: RequestHandler,
  resolvePortfolio: RequestHandler,
): ApiRouter {
  return new ApiRouter()
    .route('get', '/cms/identity', requireOwner, resolvePortfolio, controller.read)
    .route('put', '/cms/identity', requireOwner, resolvePortfolio, validate(updateIdentityRequestSchema), controller.update);
}
