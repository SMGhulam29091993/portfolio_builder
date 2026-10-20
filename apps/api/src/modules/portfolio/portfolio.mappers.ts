/**
 * Domain → CMS response shapes for the `portfolio` module (`section-engine` → API Contract).
 * Pure mapping, shared by `SectionService` and `PortfolioController` so the two cannot drift.
 */
import type { CmsPortfolio, CmsSection, Portfolio, StoredSection } from './portfolio.types.js';

export function toCmsPortfolio(portfolio: Portfolio): CmsPortfolio {
  return {
    id: portfolio.id,
    slug: portfolio.slug,
    revision: portfolio.revision,
    sectionOrder: [...portfolio.sectionOrder],
  };
}

export function toCmsSection(section: StoredSection): CmsSection {
  return {
    type: section.type,
    visible: section.visible,
    revision: section.revision,
    updatedAt: section.updatedAt.toISOString(),
    data: section.data,
  };
}
