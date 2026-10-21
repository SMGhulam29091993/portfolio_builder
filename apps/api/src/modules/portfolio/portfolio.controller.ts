/**
 * HTTP in/out for the section engine (`section-engine.T05`; API01–API06). Reads the validated
 * input and `req.portfolio` (set by `resolvePortfolio`), delegates, and answers in the standard
 * envelope. No rules live here.
 */
import type { Request, RequestHandler } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { ok } from '../../core/http/index.js';
import type { IPortfolioProvisioner, ISectionService } from './portfolio.interface.js';
import { toCmsPortfolio } from './portfolio.mappers.js';
import type {
  ChangeSlugRequest,
  ReorderSectionsRequest,
  SetVisibilityRequest,
  UpdateSectionRequest,
} from './portfolio.types.js';

export class PortfolioController {
  constructor(
    private readonly sections: ISectionService,
    private readonly provisioner: IPortfolioProvisioner,
  ) {}

  /** `GET /api/v1/cms/portfolio` — `section-engine.API01`. */
  readonly readDraft: RequestHandler = async (req, res) => {
    ok(res, 'Portfolio draft', await this.sections.readDraft(portfolioIdOf(req)));
  };

  /** `GET /api/v1/cms/portfolio/section-types` — `section-engine.API02`. */
  readonly listTypes: RequestHandler = (_req, res) => {
    ok(res, 'Section types', { types: this.sections.listTypes() });
  };

  /** `PUT /api/v1/cms/portfolio/sections/:type` — `section-engine.API03`. */
  readonly updateSection: RequestHandler = async (req, res) => {
    const { expectedRevision, data } = req.validatedBody as UpdateSectionRequest;
    const section = await this.sections.updateSection(
      portfolioIdOf(req),
      typeOf(req),
      expectedRevision,
      data,
    );
    ok(res, 'Section saved', { section });
  };

  /** `PATCH /api/v1/cms/portfolio/sections/:type/visibility` — `section-engine.API04`. */
  readonly setVisibility: RequestHandler = async (req, res) => {
    const { expectedRevision, visible } = req.validatedBody as SetVisibilityRequest;
    const section = await this.sections.setVisibility(
      portfolioIdOf(req),
      typeOf(req),
      expectedRevision,
      visible,
    );
    ok(res, visible ? 'Section shown' : 'Section hidden', { section });
  };

  /** `PUT /api/v1/cms/portfolio/section-order` — `section-engine.API05`. */
  readonly reorder: RequestHandler = async (req, res) => {
    const { expectedRevision, order } = req.validatedBody as ReorderSectionsRequest;
    const portfolio = await this.sections.reorder(portfolioIdOf(req), expectedRevision, order);
    ok(res, 'Order saved', { portfolio: toCmsPortfolio(portfolio) });
  };

  /** `PUT /api/v1/cms/portfolio/slug` — `section-engine.API06`. */
  readonly changeSlug: RequestHandler = async (req, res) => {
    const { expectedRevision, slug } = req.validatedBody as ChangeSlugRequest;
    const portfolio = await this.provisioner.changeSlug(portfolioIdOf(req), expectedRevision, slug);
    ok(res, 'Address saved', { portfolio: toCmsPortfolio(portfolio) });
  };
}

/** The resolved portfolio; `resolvePortfolio` always runs first on these routes. */
function portfolioIdOf(req: Request): string {
  if (!req.portfolio) throw new UnauthenticatedError();
  return req.portfolio.portfolioId;
}

function typeOf(req: Request): string {
  return (req.validatedParams as { type: string }).type;
}
