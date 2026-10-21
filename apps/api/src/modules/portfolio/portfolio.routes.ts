/**
 * Router factory for the section engine, mounted under `/api/v1` (`section-engine.T05`).
 * Documented in `openapi/openapi.yaml` as `section-engine.API01`–`API06`.
 *
 * Every route runs `requireOwner` then `resolvePortfolio` (`architecture.md` → Request
 * lifecycle), both injected by the container. The Origin allow-list already covers every
 * non-GET under `/cms` (`owner-auth.T06`), so none is added here.
 */
import type { RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { PortfolioController } from './portfolio.controller.js';
import {
  changeSlugRequestSchema,
  reorderSectionsRequestSchema,
  sectionParamsSchema,
  setVisibilityRequestSchema,
  updateSectionRequestSchema,
} from './portfolio.types.js';

/**
 * @param controller - The engine's controller.
 * @param requireOwner - The session guard (`auth`).
 * @param resolvePortfolio - Sets `req.portfolio` to the signed-in user's portfolio.
 */
export function createPortfolioRouter(
  controller: PortfolioController,
  requireOwner: RequestHandler,
  resolvePortfolio: RequestHandler,
): ApiRouter {
  const signedIn = [requireOwner, resolvePortfolio];
  return new ApiRouter()
    .route('get', '/cms/portfolio', ...signedIn, controller.readDraft)
    .route('get', '/cms/portfolio/section-types', ...signedIn, controller.listTypes)
    .route(
      'put',
      '/cms/portfolio/sections/:type',
      ...signedIn,
      validate(sectionParamsSchema, 'params'),
      validate(updateSectionRequestSchema),
      controller.updateSection,
    )
    .route(
      'patch',
      '/cms/portfolio/sections/:type/visibility',
      ...signedIn,
      validate(sectionParamsSchema, 'params'),
      validate(setVisibilityRequestSchema),
      controller.setVisibility,
    )
    .route(
      'put',
      '/cms/portfolio/section-order',
      ...signedIn,
      validate(reorderSectionsRequestSchema),
      controller.reorder,
    )
    .route('put', '/cms/portfolio/slug', ...signedIn, validate(changeSlugRequestSchema), controller.changeSlug);
}
