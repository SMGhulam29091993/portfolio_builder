/**
 * Public surface of the `portfolio` module: interfaces and types only
 * (`constitution.md` → Module boundaries).
 */
export type { IPortfolioRepository, ISectionRepository } from './portfolio.interface.js';
export type {
  NewPortfolio,
  NewSection,
  Portfolio,
  PortfolioContext,
  SectionChanges,
  StoredSection,
} from './portfolio.types.js';
