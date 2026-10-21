/**
 * MongoDB access for `identities` (`site-identity.T02`). Scoped by `portfolioId`; writes after
 * creation are one conditional update on `revision`.
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type { IIdentityRepository } from './identity.interface.js';
import { identityModel, type IdentityDocument } from './identity.model.js';
import type { Identity, StoredIdentity } from './identity.types.js';

const DUPLICATE_KEY = 11_000;

type LeanIdentity = IdentityDocument & { _id: unknown };

export class IdentityRepository implements IIdentityRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async find(portfolioId: string): Promise<StoredIdentity | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const found = await this.model().findOne({ portfolioId }).lean<LeanIdentity>().exec();
    return found ? toIdentity(found) : null;
  }

  async create(portfolioId: string, data: Identity): Promise<StoredIdentity> {
    try {
      const created = await this.model().create({ portfolioId, data, revision: 1 });
      return toIdentity(created.toObject());
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === DUPLICATE_KEY) {
        throw new ConflictError('IDENTITY_EXISTS', {}, 'The identity already exists');
      }
      throw error;
    }
  }

  async update(portfolioId: string, expectedRevision: number, data: Identity): Promise<StoredIdentity | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const updated = await this.model()
      .findOneAndUpdate({ portfolioId, revision: expectedRevision }, { $set: { data }, $inc: { revision: 1 } }, { new: true })
      .lean<LeanIdentity>()
      .exec();
    return updated ? toIdentity(updated) : null;
  }

  private model() {
    return identityModel(this.connections.getConnection());
  }
}

function toIdentity(document: LeanIdentity): StoredIdentity {
  return {
    portfolioId: document.portfolioId.toString(),
    revision: document.revision,
    data: document.data as Identity,
    updatedAt: document.updatedAt,
  };
}
