/** HTTP in/out for the design (`design-theme.T04`; API01–API03). */
import { FONT_ALLOW_LIST, VARIANT_CATALOGUE } from '@portfolio/design-tokens';
import type { Request, RequestHandler } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { ok } from '../../core/http/index.js';
import type { IDesignService } from './design.interface.js';
import type { ResetDesignRequest, UpdateDesignRequest } from './design.types.js';

/** What API01 offers the CMS to choose from. */
const CATALOGUE = Object.freeze({ variants: VARIANT_CATALOGUE, fonts: FONT_ALLOW_LIST });

export class DesignController {
  constructor(private readonly designs: IDesignService) {}

  /** `GET /api/v1/cms/design` — `design-theme.API01`. */
  readonly read: RequestHandler = async (req, res) => {
    ok(res, 'Design', { design: await this.designs.read(portfolioIdOf(req)), catalogue: CATALOGUE });
  };

  /** `PUT /api/v1/cms/design` — `design-theme.API02`. */
  readonly update: RequestHandler = async (req, res) => {
    const { expectedRevision, theme, layout } = req.validatedBody as UpdateDesignRequest;
    ok(res, 'Design saved', { design: await this.designs.apply(portfolioIdOf(req), { theme, layout }, expectedRevision) });
  };

  /** `POST /api/v1/cms/design/reset` — `design-theme.API03`. */
  readonly reset: RequestHandler = async (req, res) => {
    const { expectedRevision } = req.validatedBody as ResetDesignRequest;
    ok(res, 'Design reset', { design: await this.designs.reset(portfolioIdOf(req), expectedRevision) });
  };
}

function portfolioIdOf(req: Request): string {
  if (!req.portfolio) throw new UnauthenticatedError();
  return req.portfolio.portfolioId;
}
