/**
 * Router factory for the public site, mounted under `/api/v1` (`public-site-rendering.T01`).
 * Anonymous and read-only; one rate limiter covers every route.
 */
import type { RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { PublicSiteController } from './public-site.controller.js';
import { publicAssetParamsSchema, publicPortfolioParamsSchema } from './public-site.types.js';

export function createPublicSiteRouter(controller: PublicSiteController, rateLimit: RequestHandler): ApiRouter {
  return new ApiRouter()
    .route('get', '/public/portfolios', rateLimit, controller.published)
    .route('get', '/public/portfolios/:slug', rateLimit, validate(publicPortfolioParamsSchema, 'params'), controller.portfolio)
    .route(
      'get',
      '/public/portfolios/:slug/assets/:id/:filename',
      rateLimit,
      validate(publicAssetParamsSchema, 'params'),
      controller.asset,
    );
}
