/**
 * In-memory fakes of the `portfolio` module's repositories for service tests. Each passes the
 * same contract suite as its MongoDB implementation (`portfolio-repositories.contract.spec.ts`,
 * `section-engine.CT02`), including the unique-index rules and conditional updates. Stored data
 * is deep-copied in and out, as a database round trip would.
 */
import { Types } from 'mongoose';

import { ConflictError } from '../../core/errors/index.js';
import type {
  IPortfolioRepository,
  ISectionRepository,
  NewPortfolio,
  NewSection,
  Portfolio,
  SectionChanges,
  StoredSection,
} from '../../modules/portfolio/index.js';

export class InMemoryPortfolioRepository implements IPortfolioRepository {
  private readonly portfolios = new Map<string, Portfolio>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  findByUserId(userId: string): Promise<Portfolio | null> {
    return Promise.resolve(this.find((portfolio) => portfolio.userId === userId));
  }

  findById(id: string): Promise<Portfolio | null> {
    return Promise.resolve(this.portfolios.get(id) ?? null);
  }

  findBySlug(slug: string): Promise<Portfolio | null> {
    return Promise.resolve(this.find((portfolio) => portfolio.slug === slug));
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async so conflicts reject.
  async create(portfolio: NewPortfolio): Promise<Portfolio> {
    if (this.find((existing) => existing.userId === portfolio.userId)) {
      throw new ConflictError('PORTFOLIO_EXISTS', {}, 'This user already has a portfolio');
    }
    this.assertSlugFree(portfolio.slug);
    const at = this.now();
    const created: Portfolio = {
      id: new Types.ObjectId().toString(),
      userId: portfolio.userId,
      slug: portfolio.slug,
      sectionOrder: [...portfolio.sectionOrder],
      revision: 1,
      createdAt: at,
      updatedAt: at,
    };
    this.portfolios.set(created.id, created);
    return created;
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- mirrors the async repository.
  async updateOrder(id: string, expectedRevision: number, order: readonly string[]) {
    return this.conditional(id, expectedRevision, { sectionOrder: [...order] });
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async so conflicts reject.
  async updateSlug(id: string, expectedRevision: number, slug: string) {
    const current = this.portfolios.get(id);
    if (current?.revision === expectedRevision && current.slug !== slug) this.assertSlugFree(slug);
    return this.conditional(id, expectedRevision, { slug });
  }

  private conditional(id: string, expectedRevision: number, set: Partial<Portfolio>): Portfolio | null {
    const current = this.portfolios.get(id);
    if (current?.revision !== expectedRevision) return null;
    const updated: Portfolio = { ...current, ...set, revision: current.revision + 1, updatedAt: this.now() };
    this.portfolios.set(id, updated);
    return updated;
  }

  private assertSlugFree(slug: string): void {
    if (this.find((existing) => existing.slug === slug)) {
      throw new ConflictError('SLUG_TAKEN', {}, 'That address is already taken');
    }
  }

  private find(predicate: (portfolio: Portfolio) => boolean): Portfolio | null {
    return [...this.portfolios.values()].find(predicate) ?? null;
  }
}

export class InMemorySectionRepository implements ISectionRepository {
  private readonly sections = new Map<string, StoredSection>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  listByPortfolio(portfolioId: string): Promise<StoredSection[]> {
    return Promise.resolve(
      [...this.sections.values()].filter((section) => section.portfolioId === portfolioId).map(copy),
    );
  }

  find(portfolioId: string, type: string): Promise<StoredSection | null> {
    const found = this.sections.get(key(portfolioId, type));
    return Promise.resolve(found ? copy(found) : null);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async so conflicts reject.
  async create(portfolioId: string, section: NewSection): Promise<StoredSection> {
    if (this.sections.has(key(portfolioId, section.type))) {
      throw new ConflictError('SECTION_EXISTS', {}, 'The section already exists');
    }
    const at = this.now();
    const created: StoredSection = {
      id: new Types.ObjectId().toString(),
      portfolioId,
      type: section.type,
      visible: section.visible,
      revision: 1,
      data: structuredClone(section.data),
      createdAt: at,
      updatedAt: at,
    };
    this.sections.set(key(portfolioId, section.type), created);
    return copy(created);
  }

  async createMissing(portfolioId: string, sections: readonly NewSection[]): Promise<number> {
    let created = 0;
    for (const section of sections) {
      if (this.sections.has(key(portfolioId, section.type))) continue;
      await this.create(portfolioId, section);
      created += 1;
    }
    return created;
  }

  update(
    portfolioId: string,
    type: string,
    expectedRevision: number,
    changes: SectionChanges,
  ): Promise<StoredSection | null> {
    const current = this.sections.get(key(portfolioId, type));
    if (current?.revision !== expectedRevision) return Promise.resolve(null);
    const updated: StoredSection = {
      ...current,
      ...(changes.data === undefined ? {} : { data: structuredClone(changes.data) }),
      ...(changes.visible === undefined ? {} : { visible: changes.visible }),
      revision: current.revision + 1,
      updatedAt: this.now(),
    };
    this.sections.set(key(portfolioId, type), updated);
    return Promise.resolve(copy(updated));
  }
}

function key(portfolioId: string, type: string): string {
  return `${portfolioId}:${type}`;
}

function copy(section: StoredSection): StoredSection {
  return { ...section, data: structuredClone(section.data) };
}
