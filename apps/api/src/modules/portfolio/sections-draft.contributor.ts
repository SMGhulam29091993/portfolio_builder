/**
 * Contributes the draft's sections to a publish (`publish-pipeline.T02`; AC9). Implements
 * `IDraftContributor` owned by `publishing` (ADR-0013). Reports every registered section with its
 * visibility, and the render order: fixed (non-orderable) types first, then `sectionOrder`.
 * Hiding and ordering are applied by the snapshot builder, not here. Read-only.
 */
import { NotFoundError } from '../../core/errors/index.js';
import type { DraftScope, IDraftContributor, SectionsDraft } from '../publishing/index.js';
import type { IPortfolioRepository, ISectionRegistry, ISectionRepository } from './portfolio.interface.js';

export class SectionsDraftContributor implements IDraftContributor<'sections'> {
  readonly key = 'sections' as const;

  constructor(
    private readonly portfolios: Pick<IPortfolioRepository, 'findById'>,
    private readonly sections: Pick<ISectionRepository, 'listByPortfolio'>,
    private readonly registry: ISectionRegistry,
  ) {}

  async collect({ portfolioId }: DraftScope): Promise<SectionsDraft> {
    const [portfolio, stored] = await Promise.all([
      this.portfolios.findById(portfolioId),
      this.sections.listByPortfolio(portfolioId),
    ]);
    if (!portfolio) throw new NotFoundError('Portfolio not found');
    const fixed = this.registry.list().filter((definition) => !definition.orderable).map((definition) => definition.type);
    return {
      order: [...fixed, ...portfolio.sectionOrder],
      // A stored type that is no longer registered cannot be rendered, so it is never published.
      // A type that cannot be hidden is published visible even if an earlier version stored it
      // hidden (memory/pitfalls.md, 2026-10-21).
      sections: stored.flatMap(({ type, visible, data }) => {
        const definition = this.registry.get(type);
        return definition ? [{ type, visible: visible || !definition.hideable, data }] : [];
      }),
    };
  }
}
