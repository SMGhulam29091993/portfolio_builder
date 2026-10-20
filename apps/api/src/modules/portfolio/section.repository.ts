/**
 * MongoDB access for `sections` (`section-engine.T02`). Every query is scoped by `portfolioId`,
 * the tenant boundary (`constitution.md` → Tenant isolation); updates are single conditional
 * writes on `revision` (`int-standards.express.md` → Optimistic concurrency).
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type { ISectionRepository } from './portfolio.interface.js';
import { sectionModel, type SectionDocument } from './portfolio.model.js';
import type { NewSection, SectionChanges, StoredSection } from './portfolio.types.js';

const DUPLICATE_KEY = 11_000;

type LeanSection = SectionDocument & { _id: { toString(): string } };

export class SectionRepository implements ISectionRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async listByPortfolio(portfolioId: string): Promise<StoredSection[]> {
    if (!isValidObjectId(portfolioId)) return [];
    const found = await this.model().find({ portfolioId }).lean<LeanSection[]>().exec();
    return found.map(toSection);
  }

  async find(portfolioId: string, type: string): Promise<StoredSection | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const found = await this.model().findOne({ portfolioId, type }).lean<LeanSection>().exec();
    return found ? toSection(found) : null;
  }

  async create(portfolioId: string, section: NewSection): Promise<StoredSection> {
    try {
      const created = await this.model().create({ portfolioId, ...section, revision: 1 });
      return toSection(created.toObject());
    } catch (error) {
      if (isDuplicateKey(error)) {
        throw new ConflictError('SECTION_EXISTS', {}, 'The section already exists');
      }
      throw error;
    }
  }

  async createMissing(portfolioId: string, sections: readonly NewSection[]): Promise<number> {
    if (sections.length === 0) return 0;
    // One upsert per type that only ever inserts (`$setOnInsert`), so an existing section —
    // edited or not — is never overwritten, and a parallel run cannot duplicate one.
    const result = await this.model().bulkWrite(
      sections.map((section) => ({
        updateOne: {
          filter: { portfolioId, type: section.type },
          update: {
            $setOnInsert: {
              portfolioId,
              type: section.type,
              visible: section.visible,
              data: section.data,
              revision: 1,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return result.upsertedCount;
  }

  async update(
    portfolioId: string,
    type: string,
    expectedRevision: number,
    changes: SectionChanges,
  ): Promise<StoredSection | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const set: Partial<SectionDocument> = {};
    if (changes.data !== undefined) set.data = changes.data;
    if (changes.visible !== undefined) set.visible = changes.visible;
    const updated = await this.model()
      .findOneAndUpdate(
        { portfolioId, type, revision: expectedRevision },
        { $set: set, $inc: { revision: 1 } },
        { new: true },
      )
      .lean<LeanSection>()
      .exec();
    return updated ? toSection(updated) : null;
  }

  private model() {
    return sectionModel(this.connections.getConnection());
  }
}

function toSection(document: LeanSection): StoredSection {
  return {
    id: document._id.toString(),
    portfolioId: document.portfolioId.toString(),
    type: document.type,
    visible: document.visible,
    revision: document.revision,
    data: document.data,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

function isDuplicateKey(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === DUPLICATE_KEY;
}
