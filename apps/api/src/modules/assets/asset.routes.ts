/**
 * Router factory for assets, mounted under `/api/v1` (`media-assets.T05`). Documented as
 * `media-assets.API01`–`API04`. Every route runs `requireOwner` then `resolvePortfolio`; the
 * Origin allow-list already covers the upload and delete.
 */
import type { RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { AssetController } from './asset.controller.js';
import { assetIdParamsSchema, listAssetsQuerySchema } from './assets.types.js';

export function createAssetRouter(
  controller: AssetController,
  requireOwner: RequestHandler,
  resolvePortfolio: RequestHandler,
): ApiRouter {
  const signedIn = [requireOwner, resolvePortfolio];
  return new ApiRouter()
    .route('post', '/cms/assets', ...signedIn, controller.upload)
    .route('get', '/cms/assets', ...signedIn, validate(listAssetsQuerySchema, 'query'), controller.list)
    .route('delete', '/cms/assets/:id', ...signedIn, validate(assetIdParamsSchema, 'params'), controller.remove)
    .route('get', '/cms/assets/:id/content', ...signedIn, validate(assetIdParamsSchema, 'params'), controller.content);
}
