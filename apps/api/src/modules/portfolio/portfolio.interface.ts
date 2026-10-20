/**
 * Contracts of the `portfolio` module, owned on the consuming side and role-sized
 * (`constitution.md` → SOLID). Persistence ports from `section-engine.T02`; registry and id
 * ports from `T03`; service ports from `T04`; HTTP ports from `T05`.
 */
import type {
  NewPortfolio,
  NewSection,
  Portfolio,
  SectionChanges,
  StoredSection,
} from './portfolio.types.js';

/** The `portfolios` collection. */
export interface IPortfolioRepository {
  findByUserId(userId: string): Promise<Portfolio | null>;
  findById(id: string): Promise<Portfolio | null>;
  findBySlug(slug: string): Promise<Portfolio | null>;
  /**
   * @throws {ConflictError} `PORTFOLIO_EXISTS` — this user already has one (a provisioning
   *   race); `SLUG_TAKEN` — another portfolio holds the slug.
   */
  create(portfolio: NewPortfolio): Promise<Portfolio>;
  /**
   * Replaces `sectionOrder` while the revision equals `expectedRevision`, incrementing it.
   *
   * @returns The updated portfolio, or `null` when the revision did not match.
   */
  updateOrder(id: string, expectedRevision: number, order: readonly string[]): Promise<Portfolio | null>;
  /**
   * Replaces the slug while the revision equals `expectedRevision`, incrementing it.
   *
   * @returns The updated portfolio, or `null` when the revision did not match.
   * @throws {ConflictError} `SLUG_TAKEN` — another portfolio holds the slug.
   */
  updateSlug(id: string, expectedRevision: number, slug: string): Promise<Portfolio | null>;
}

/** The `sections` collection. Every method is scoped by `portfolioId` (tenant isolation). */
export interface ISectionRepository {
  listByPortfolio(portfolioId: string): Promise<StoredSection[]>;
  find(portfolioId: string, type: string): Promise<StoredSection | null>;
  /**
   * Creates the section at revision 1.
   *
   * @throws {ConflictError} `SECTION_EXISTS` — the type already has a document here.
   */
  create(portfolioId: string, section: NewSection): Promise<StoredSection>;
  /**
   * Creates every section that does not exist yet and leaves existing ones untouched — the
   * idempotent half of provisioning and seeding.
   *
   * @returns How many were created.
   */
  createMissing(portfolioId: string, sections: readonly NewSection[]): Promise<number>;
  /**
   * Applies `changes` while the revision equals `expectedRevision`, incrementing it.
   *
   * @returns The updated section, or `null` when it is missing or the revision did not match.
   */
  update(
    portfolioId: string,
    type: string,
    expectedRevision: number,
    changes: SectionChanges,
  ): Promise<StoredSection | null>;
}
