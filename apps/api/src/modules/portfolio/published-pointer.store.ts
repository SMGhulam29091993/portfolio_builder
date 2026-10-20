/**
 * `PublishedPointerStore` — the live snapshot pointer on `portfolios` (`publish-pipeline.T02`; AC3, AC13, AC15, AC16).
 * Implements the ports `publishing` owns (ADR-0013), so `portfolio` stays the only writer of
 * its collection and `publishing` imports none of its classes.
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import type { IPublishedPointerReader, IPublishedPointerWriter, PointerState, PublishedPointer } from '../publishing/index.js';
import { portfolioModel, type PortfolioDocument } from './portfolio.model.js';

type LeanPortfolio = Pick<PortfolioDocument, 'slug' | 'publishedSnapshotId' | 'publishedVersion' | 'publishedAt'> & {
  _id: { toString(): string };
};

const POINTER_FIELDS = { slug: 1, publishedSnapshotId: 1, publishedVersion: 1, publishedAt: 1 } as const;

export class PublishedPointerStore implements IPublishedPointerWriter, IPublishedPointerReader {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async switchTo(portfolioId: string, expectedSnapshotId: string | null, next: PublishedPointer): Promise<boolean> {
    if (!isValidObjectId(portfolioId)) return false;
    // The filter is the compare: `null` also matches a document written before the field existed.
    const result = await this.model()
      .updateOne(
        { _id: portfolioId, publishedSnapshotId: expectedSnapshotId },
        { $set: { publishedSnapshotId: next.snapshotId, publishedVersion: next.version, publishedAt: next.publishedAt } },
        { timestamps: false },
      )
      .exec();
    return result.modifiedCount === 1;
  }

  async read(portfolioId: string): Promise<PointerState | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const found = await this.model().findById(portfolioId, POINTER_FIELDS).lean<LeanPortfolio>().exec();
    return found ? toState(found) : null;
  }

  async findBySlug(slug: string): Promise<PointerState | null> {
    const found = await this.model().findOne({ slug }, POINTER_FIELDS).lean<LeanPortfolio>().exec();
    return found ? toState(found) : null;
  }

  async listPublished(): Promise<PointerState[]> {
    const found = await this.model()
      .find({ publishedSnapshotId: { $ne: null } }, POINTER_FIELDS)
      .sort({ slug: 1 })
      .lean<LeanPortfolio[]>()
      .exec();
    return found.map(toState);
  }

  private model() {
    return portfolioModel(this.connections.getConnection());
  }
}

function toState(document: LeanPortfolio): PointerState {
  const { publishedSnapshotId, publishedVersion, publishedAt } = document;
  return {
    portfolioId: document._id.toString(),
    slug: document.slug,
    pointer:
      publishedSnapshotId && publishedVersion !== null && publishedAt
        ? { snapshotId: publishedSnapshotId.toString(), version: publishedVersion, publishedAt }
        : null,
  };
}
