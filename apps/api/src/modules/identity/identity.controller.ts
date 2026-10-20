/** HTTP in/out for the identity (`site-identity.T04`; API01–API02). */
import type { Request, RequestHandler } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { ok } from '../../core/http/index.js';
import type { IIdentityService } from './identity.interface.js';
import type { UpdateIdentityRequest } from './identity.types.js';

export class IdentityController {
  constructor(private readonly identities: IIdentityService) {}

  /** `GET /api/v1/cms/identity` — `site-identity.API01`. */
  readonly read: RequestHandler = async (req, res) => {
    const { portfolioId, userId } = scope(req);
    ok(res, 'Identity', { identity: await this.identities.draft(portfolioId, userId) });
  };

  /** `PUT /api/v1/cms/identity` — `site-identity.API02`. */
  readonly update: RequestHandler = async (req, res) => {
    const { expectedRevision, data } = req.validatedBody as UpdateIdentityRequest;
    ok(res, 'Identity saved', { identity: await this.identities.update(scope(req).portfolioId, expectedRevision, data) });
  };
}

function scope(req: Request): { portfolioId: string; userId: string } {
  if (!req.auth || !req.portfolio) throw new UnauthenticatedError();
  return { portfolioId: req.portfolio.portfolioId, userId: req.auth.userId };
}
