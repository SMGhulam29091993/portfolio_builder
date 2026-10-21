/** MongoDB access for `designs` (`design-theme.T02`): scoped by portfolio, conditional writes. */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type { IDesignRepository } from './design.interface.js';
import { designModel, type DesignDocument } from './design.model.js';
import type { DesignSpec, StoredDesign } from './design.types.js';

const DUPLICATE_KEY = 11_000;

export class DesignRepository implements IDesignRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async find(portfolioId: string): Promise<StoredDesign | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const found = await this.model().findOne({ portfolioId }).lean<DesignDocument>().exec();
    return found ? toDesign(found) : null;
  }

  async create(portfolioId: string, design: DesignSpec): Promise<StoredDesign> {
    try {
      const created = await this.model().create({ portfolioId, ...design, revision: 1 });
      return toDesign(created.toObject());
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === DUPLICATE_KEY) {
        throw new ConflictError('DESIGN_EXISTS', {}, 'The design already exists');
      }
      throw error;
    }
  }

  async update(portfolioId: string, expectedRevision: number, design: DesignSpec): Promise<StoredDesign | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const updated = await this.model()
      .findOneAndUpdate(
        { portfolioId, revision: expectedRevision },
        { $set: { theme: design.theme, layout: design.layout }, $inc: { revision: 1 } },
        { new: true },
      )
      .lean<DesignDocument>()
      .exec();
    return updated ? toDesign(updated) : null;
  }

  private model() {
    return designModel(this.connections.getConnection());
  }
}

function toDesign(document: DesignDocument): StoredDesign {
  return {
    portfolioId: document.portfolioId.toString(),
    revision: document.revision,
    design: { theme: document.theme, layout: document.layout } as DesignSpec,
    updatedAt: document.updatedAt,
  };
}
