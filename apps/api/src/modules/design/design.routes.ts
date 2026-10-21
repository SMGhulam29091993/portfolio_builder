/**
 * Router factory for the design, mounted under `/api/v1` (`design-theme.T04`). Documented as
 * `design-theme.API01`–`API03` and `design-library.API01`–`API06`; each runs `requireOwner` then `resolvePortfolio`.
 */
import type { RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { DesignLibraryController } from './design-library.controller.js';
import type { DesignController } from './design.controller.js';
import {
  applyPresetRequestSchema,
  libraryIdParamsSchema,
  resetDesignRequestSchema,
  savePresetRequestSchema,
  updateDesignRequestSchema,
} from './design.types.js';

export function createDesignRouter(
  controller: DesignController,
  library: DesignLibraryController,
  requireOwner: RequestHandler,
  resolvePortfolio: RequestHandler,
): ApiRouter {
  const signedIn = [requireOwner, resolvePortfolio];
  const byId = validate(libraryIdParamsSchema, 'params');
  return new ApiRouter()
    .route('get', '/cms/design', ...signedIn, controller.read)
    .route('put', '/cms/design', ...signedIn, validate(updateDesignRequestSchema), controller.update)
    .route('post', '/cms/design/reset', ...signedIn, validate(resetDesignRequestSchema), controller.reset)
    // `design-library.API01`–`API06` (the layout library and presets).
    .route('get', '/cms/design/layouts', ...signedIn, library.listLayouts)
    .route('delete', '/cms/design/layouts/:id', ...signedIn, byId, library.deleteLayout)
    .route('get', '/cms/design/presets', ...signedIn, library.listPresets)
    .route('post', '/cms/design/presets', ...signedIn, validate(savePresetRequestSchema), library.savePreset)
    .route('post', '/cms/design/presets/:id/apply', ...signedIn, byId, validate(applyPresetRequestSchema), library.applyPreset)
    .route('delete', '/cms/design/presets/:id', ...signedIn, byId, library.deletePreset);
}
