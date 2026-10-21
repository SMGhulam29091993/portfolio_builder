/**
 * MongoDB access for `portfolios` (`section-engine.T02`). Queries only; returns plain domain
 * objects. Writes after creation are single conditional updates on `revision`
 * (`int-standards.express.md` → Optimistic concurrency).
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type { IPortfolioRepository } from './portfolio.interface.js';
import { portfolioModel, type PortfolioDocument } from './portfolio.model.js';
import type { NewPortfolio, Portfolio } from './portfolio.types.js';

const DUPLICATE_KEY = 11_000;

type LeanPortfolio = PortfolioDocument & { _id: { toString(): string } };

export class PortfolioRepository implements IPortfolioRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async findByUserId(userId: string): Promise<Portfolio | null> {
    if (!isValidObjectId(userId)) return null;
    const found = await this.model().findOne({ userId }).lean<LeanPortfolio>().exec();
    return found ? toPortfolio(found) : null;
  }

  async findById(id: string): Promise<Portfolio | null> {
    if (!isValidObjectId(id)) return null;
    const found = await this.model().findById(id).lean<LeanPortfolio>().exec();
    return found ? toPortfolio(found) : null;
  }

  async findBySlug(slug: string): Promise<Portfolio | null> {
    const found = await this.model().findOne({ slug }).lean<LeanPortfolio>().exec();
    return found ? toPortfolio(found) : null;
  }

  async create(portfolio: NewPortfolio): Promise<Portfolio> {
    try {
      const created = await this.model().create({
        userId: portfolio.userId,
        slug: portfolio.slug,
        sectionOrder: [...portfolio.sectionOrder],
        revision: 1,
      });
      return toPortfolio(created.toObject());
    } catch (error) {
      throw toConflict(error) ?? error;
    }
  }

  async updateOrder(
    id: string,
    expectedRevision: number,
    order: readonly string[],
  ): Promise<Portfolio | null> {
    return this.conditional(id, expectedRevision, { sectionOrder: [...order] });
  }

  async updateSlug(id: string, expectedRevision: number, slug: string): Promise<Portfolio | null> {
    try {
      return await this.conditional(id, expectedRevision, { slug });
    } catch (error) {
      throw toConflict(error) ?? error;
    }
  }

  /** One `findOneAndUpdate` keyed on `{ _id, revision }`: the check and the write are atomic. */
  private async conditional(
    id: string,
    expectedRevision: number,
    set: Partial<PortfolioDocument>,
  ): Promise<Portfolio | null> {
    if (!isValidObjectId(id)) return null;
    const updated = await this.model()
      .findOneAndUpdate(
        { _id: id, revision: expectedRevision },
        { $set: set, $inc: { revision: 1 } },
        { new: true },
      )
      .lean<LeanPortfolio>()
      .exec();
    return updated ? toPortfolio(updated) : null;
  }

  private model() {
    return portfolioModel(this.connections.getConnection());
  }
}

function toPortfolio(document: LeanPortfolio): Portfolio {
  return {
    id: document._id.toString(),
    userId: document.userId.toString(),
    slug: document.slug,
    sectionOrder: [...document.sectionOrder],
    revision: document.revision,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

/** `SLUG_TAKEN` for the slug index, `PORTFOLIO_EXISTS` for the user index; else `null`. */
function toConflict(error: unknown): ConflictError | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  if (error.code !== DUPLICATE_KEY) return null;
  const keyPattern = 'keyPattern' in error ? (error.keyPattern as Record<string, unknown>) : {};
  if ('slug' in keyPattern) {
    return new ConflictError('SLUG_TAKEN', {}, 'That address is already taken');
  }
  return new ConflictError('PORTFOLIO_EXISTS', {}, 'This user already has a portfolio');
}
