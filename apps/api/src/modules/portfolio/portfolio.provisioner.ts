/**
 * `IPortfolioProvisioner` — every user's one portfolio (`section-engine.T04`; spec → Portfolio
 * provisioning, Slug rules; ADR-0010).
 *
 * `resolveFor` returns the user's portfolio, creating it on first use from the reference
 * template: each registered definition's `defaults()` (bracketed placeholder content), all
 * visible, the orderable types in registration order, and a slug from the display name. The
 * unique indexes settle races: a lost `PORTFOLIO_EXISTS` reads the winner's portfolio, a lost
 * `SLUG_TAKEN` tries the next suffix. Sections are created insert-only, so a repeat never
 * overwrites an edit.
 */
import { RESERVED_SLUGS, SLUG_PATTERN } from '@portfolio/contracts';

import { ConflictError } from '../../core/errors/index.js';
import type {
  IPortfolioProvisioner,
  IPortfolioRepository,
  ISectionRegistry,
  ISectionRepository,
  IUserDirectory,
} from './portfolio.interface.js';
import type { Portfolio } from './portfolio.types.js';

/** Longest base taken from a display name, leaving room for a `-<n>` suffix within 40. */
const SLUG_BASE_MAX = 32;

/** The base when a name yields nothing usable. */
const FALLBACK_SLUG = 'portfolio';

/** Suffixes tried before giving up on a creation (a slug race that keeps losing is a bug). */
const MAX_SLUG_ATTEMPTS = 50;

export class PortfolioProvisioner implements IPortfolioProvisioner {
  constructor(
    private readonly portfolios: IPortfolioRepository,
    private readonly sections: ISectionRepository,
    private readonly registry: ISectionRegistry,
    private readonly users: IUserDirectory,
  ) {}

  async resolveFor(userId: string): Promise<Portfolio> {
    const existing = await this.portfolios.findByUserId(userId);
    if (existing) return existing;

    const base = initialSlug((await this.users.displayNameOf(userId)) ?? '');
    const order = this.registry
      .list()
      .filter((definition) => definition.orderable)
      .map((definition) => definition.type);

    const portfolio = await this.createWithFreeSlug(userId, base, order);
    await this.sections.createMissing(
      portfolio.id,
      this.registry.list().map((definition) => ({
        type: definition.type,
        visible: true,
        data: definition.defaults(),
      })),
    );
    return portfolio;
  }

  async changeSlug(portfolioId: string, expectedRevision: number, slug: string): Promise<Portfolio> {
    if (RESERVED_SLUGS.includes(slug)) throw slugTaken();
    const updated = await this.portfolios.updateSlug(portfolioId, expectedRevision, slug);
    if (updated) return updated;
    const current = await this.portfolios.findById(portfolioId);
    throw new ConflictError(
      'REVISION_CONFLICT',
      { currentRevision: current?.revision ?? 0 },
      'This was changed elsewhere. Reload to see the latest version',
    );
  }

  private async createWithFreeSlug(
    userId: string,
    base: string,
    order: readonly string[],
  ): Promise<Portfolio> {
    for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt += 1) {
      const slug = attempt === 1 ? base : `${base}-${String(attempt)}`;
      if (await this.portfolios.findBySlug(slug)) continue;
      try {
        return await this.portfolios.create({ userId, slug, sectionOrder: order });
      } catch (error) {
        if (!(error instanceof ConflictError)) throw error;
        if (error.code === 'PORTFOLIO_EXISTS') {
          // Another request provisioned this user first: use theirs (AC15).
          const winner = await this.portfolios.findByUserId(userId);
          if (winner) return winner;
        }
        // `SLUG_TAKEN`: someone took this slug between the check and the insert; try the next.
      }
    }
    throw new ConflictError('SLUG_TAKEN', {}, 'No free address could be chosen');
  }
}

/**
 * The initial slug for a display name (spec → Slug rules; `section-engine.UT13`): lower-cased,
 * every run of other characters a single hyphen, trimmed of hyphens, cut to 32; a result that is
 * too short, malformed or reserved becomes `portfolio`. Uniqueness is handled by the caller.
 */
export function initialSlug(displayName: string): string {
  const base = displayName
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, SLUG_BASE_MAX)
    .replace(/^-+|-+$/g, '');
  if (!SLUG_PATTERN.test(base) || RESERVED_SLUGS.includes(base)) return FALLBACK_SLUG;
  return base;
}

function slugTaken(): ConflictError {
  return new ConflictError('SLUG_TAKEN', {}, 'That address is already taken');
}
