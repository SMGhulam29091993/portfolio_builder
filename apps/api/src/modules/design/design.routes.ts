/**
 * Router factory for the design, mounted under `/api/v1` (`design-theme.T04`). Documented as
 * `design-theme.API01`–`API03`; each runs `requireOwner` then `resolvePortfolio`.
 */
import type { RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { DesignController } from './design.controller.js';
import { resetDesignRequestSchema, updateDesignRequestSchema } from './design.types.js';

export function createDesignRouter(controller: DesignController, requireOwner: RequestHandler, resolvePortfolio: RequestHandler): ApiRouter {
  const signedIn = [requireOwner, resolvePortfolio];
  return new ApiRouter()
    .route('get', '/cms/design', ...signedIn, controller.read)
    .route('put', '/cms/design', ...signedIn, validate(updateDesignRequestSchema), controller.update)
    .route('post', '/cms/design/reset', ...signedIn, validate(resetDesignRequestSchema), controller.reset);
}
