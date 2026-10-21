/**
 * Router factory for publishing, mounted under `/api/v1` (`publish-pipeline.T08`). Documented
 * as `publish-pipeline.API01`–`API06`; each runs `requireOwner` then `resolvePortfolio`, so every
 * route acts on the signed-in user's portfolio (ADR-0010).
 */
import type { RequestHandler } from 'express';

import { ApiRouter, validate } from '../../core/http/index.js';
import type { PublishingController } from './publishing.controller.js';
import { listSnapshotsQuerySchema, publishRequestSchema, snapshotVersionParamsSchema } from './publishing.types.js';

export function createPublishingRouter(
  controller: PublishingController,
  requireOwner: RequestHandler,
  resolvePortfolio: RequestHandler,
): ApiRouter {
  const signedIn = [requireOwner, resolvePortfolio];
  return new ApiRouter()
    .route('get', '/cms/publishing/status', ...signedIn, controller.status)
    .route('post', '/cms/publishing/validate', ...signedIn, controller.validate)
    .route('post', '/cms/publishing/publish', ...signedIn, validate(publishRequestSchema), controller.publish)
    .route('get', '/cms/publishing/snapshots', ...signedIn, validate(listSnapshotsQuerySchema, 'query'), controller.history)
    .route(
      'post',
      '/cms/publishing/snapshots/:version/activate',
      ...signedIn,
      validate(snapshotVersionParamsSchema, 'params'),
      controller.activate,
    )
    .route('post', '/cms/publishing/revalidate', ...signedIn, controller.revalidate);
}
