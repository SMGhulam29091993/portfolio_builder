/**
 * `resolvePortfolio` — runs on every `/api/v1/cms/**` route after `requireOwner`
 * (`section-engine.T05`; `architecture.md` → Request lifecycle; ADR-0010).
 *
 * It sets `req.portfolio` to the signed-in user's own portfolio, provisioning it on first use
 * (`section-engine.AC15`). Every `/cms` controller reads the portfolio id from here and nowhere
 * else, so no request can name another user's portfolio (`constitution.md` → Tenant isolation).
 */
import type { RequestHandler } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import type { IPortfolioProvisioner } from './portfolio.interface.js';

export class ResolvePortfolioMiddleware {
  constructor(private readonly provisioner: IPortfolioProvisioner) {}

  /** The middleware itself; an arrow function so it can be passed to a router unbound. */
  readonly handle: RequestHandler = async (req, _res, next) => {
    // Mounted after the guard, which always sets `req.auth`; without it the route was wired
    // wrongly — refuse rather than act for nobody.
    if (!req.auth) throw new UnauthenticatedError();
    const portfolio = await this.provisioner.resolveFor(req.auth.userId);
    req.portfolio = { portfolioId: portfolio.id };
    next();
  };
}
