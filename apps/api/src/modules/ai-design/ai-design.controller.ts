/** HTTP in/out for AI design proposals (`ai-design-studio.T09`; API01–API06). */
import type { Request, RequestHandler } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { accepted, ok } from '../../core/http/index.js';
import type { IAiDesignService } from './ai-design.interface.js';
import type {
  AllowanceSubject,
  ApplyProposalRequest,
  CreateProposalRequest,
  ListProposalsQuery,
} from './ai-design.types.js';

export class AiDesignController {
  constructor(private readonly service: IAiDesignService) {}

  /** `POST /api/v1/cms/ai/design-proposals` — `ai-design-studio.API01`; 202, the run continues. */
  readonly create: RequestHandler = async (req, res) => {
    const proposal = await this.service.create(subjectOf(req), req.validatedBody as CreateProposalRequest);
    accepted(res, 'Design proposal started', { proposal });
  };

  /** `GET /api/v1/cms/ai/design-proposals/:id` — `ai-design-studio.API02`. */
  readonly get: RequestHandler = async (req, res) => {
    ok(res, 'Design proposal', { proposal: await this.service.get(subjectOf(req), idOf(req)) });
  };

  /** `GET /api/v1/cms/ai/design-proposals` — `ai-design-studio.API03`. */
  readonly list: RequestHandler = async (req, res) => {
    const { limit, cursor } = req.validatedQuery as ListProposalsQuery;
    ok(res, 'Design proposals', await this.service.list(subjectOf(req), limit, cursor));
  };

  /** `POST /api/v1/cms/ai/design-proposals/:id/apply` — `ai-design-studio.API04`. */
  readonly apply: RequestHandler = async (req, res) => {
    const { expectedDesignRevision } = req.validatedBody as ApplyProposalRequest;
    ok(res, 'Design proposal applied', await this.service.apply(subjectOf(req), idOf(req), expectedDesignRevision));
  };

  /** `DELETE /api/v1/cms/ai/design-proposals/:id` — `ai-design-studio.API05`. */
  readonly discard: RequestHandler = async (req, res) => {
    ok(res, 'Design proposal discarded', { proposal: await this.service.discard(subjectOf(req), idOf(req)) });
  };

  /** `GET /api/v1/cms/ai/provider` — `ai-design-studio.API06`. */
  readonly provider: RequestHandler = async (req, res) => {
    ok(res, 'Design provider', await this.service.provider(subjectOf(req)));
  };
}

/** The signed-in user and their portfolio, set by `requireOwner` and `resolvePortfolio`. */
function subjectOf(req: Request): AllowanceSubject {
  if (!req.auth || !req.portfolio) throw new UnauthenticatedError();
  return { userId: req.auth.userId, portfolioId: req.portfolio.portfolioId };
}

function idOf(req: Request): string {
  return (req.validatedParams as { id: string }).id;
}
