/** HTTP in/out for publishing (`publish-pipeline.T08`; API01–API06). */
import type { Request, RequestHandler } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { created, ok } from '../../core/http/index.js';
import type { IPublishingService } from './publishing.interface.js';
import type { DraftScope, ListSnapshotsQuery, PublishMeta, PublishRequest } from './publishing.types.js';

export class PublishingController {
  constructor(private readonly publishing: IPublishingService) {}

  /** `GET /api/v1/cms/publishing/status` — `publish-pipeline.API01`. */
  readonly status: RequestHandler = async (req, res) => {
    ok(res, 'Publishing status', await this.publishing.status(scope(req)));
  };

  /** `POST /api/v1/cms/publishing/validate` — `publish-pipeline.API02`. */
  readonly validate: RequestHandler = async (req, res) => {
    ok(res, 'Draft checked', await this.publishing.validate(scope(req)));
  };

  /** `POST /api/v1/cms/publishing/publish` — `publish-pipeline.API03`. */
  readonly publish: RequestHandler = async (req, res) => {
    created(res, 'Published', await this.publishing.publish(scope(req), req.validatedBody as PublishRequest, meta(req)));
  };

  /** `GET /api/v1/cms/publishing/snapshots` — `publish-pipeline.API04`. */
  readonly history: RequestHandler = async (req, res) => {
    ok(res, 'Snapshots', await this.publishing.history(scope(req).portfolioId, req.validatedQuery as ListSnapshotsQuery));
  };

  /** `POST /api/v1/cms/publishing/snapshots/:version/activate` — `publish-pipeline.API05`. */
  readonly activate: RequestHandler = async (req, res) => {
    const { version } = req.validatedParams as { version: number };
    ok(res, 'Version made live', await this.publishing.activate(scope(req), version, meta(req)));
  };

  /** `POST /api/v1/cms/publishing/revalidate` — `publish-pipeline.API06`. */
  readonly revalidate: RequestHandler = async (req, res) => {
    ok(res, 'Revalidation requested', { revalidation: await this.publishing.revalidate(scope(req), meta(req)) });
  };
}

function scope(req: Request): DraftScope {
  if (!req.auth || !req.portfolio) throw new UnauthenticatedError();
  return { portfolioId: req.portfolio.portfolioId, userId: req.auth.userId };
}

function meta(req: Request): PublishMeta {
  return { requestId: req.requestId };
}
