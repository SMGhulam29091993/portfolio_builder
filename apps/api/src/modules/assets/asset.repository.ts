/**
 * MongoDB access for `assets` (`media-assets.T01`). Every query is scoped by `portfolioId`;
 * another portfolio's id simply finds nothing (`media-assets.AC13`).
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type { IAssetRepository } from './assets.interface.js';
import { assetModel, type AssetDocument } from './assets.model.js';
import type { AssetKind, NewAsset, StoredAsset } from './assets.types.js';

const DUPLICATE_KEY = 11_000;

type LeanAsset = AssetDocument & { _id: { toString(): string } };

export class AssetRepository implements IAssetRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async create(asset: NewAsset): Promise<StoredAsset> {
    try {
      const created = await this.model().create(asset);
      return toAsset(created.toObject());
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === DUPLICATE_KEY) {
        throw new ConflictError('ASSET_EXISTS', {}, 'This file is already uploaded');
      }
      throw error;
    }
  }

  async findById(portfolioId: string, id: string): Promise<StoredAsset | null> {
    if (!isValidObjectId(id) || !isValidObjectId(portfolioId)) return null;
    const found = await this.model().findOne({ _id: id, portfolioId }).lean<LeanAsset>().exec();
    return found ? toAsset(found) : null;
  }

  async findByHash(portfolioId: string, sha256: string, kind: AssetKind): Promise<StoredAsset | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const found = await this.model().findOne({ portfolioId, sha256, kind }).lean<LeanAsset>().exec();
    return found ? toAsset(found) : null;
  }

  async list(portfolioId: string, kind?: AssetKind): Promise<StoredAsset[]> {
    if (!isValidObjectId(portfolioId)) return [];
    const found = await this.model()
      .find({ portfolioId, ...(kind ? { kind } : {}) })
      .sort({ createdAt: -1, _id: -1 })
      .lean<LeanAsset[]>()
      .exec();
    return found.map(toAsset);
  }

  async delete(portfolioId: string, id: string): Promise<boolean> {
    if (!isValidObjectId(id) || !isValidObjectId(portfolioId)) return false;
    const result = await this.model().deleteOne({ _id: id, portfolioId }).exec();
    return result.deletedCount === 1;
  }

  private model() {
    return assetModel(this.connections.getConnection());
  }
}

function toAsset(document: LeanAsset): StoredAsset {
  return {
    id: document._id.toString(),
    portfolioId: document.portfolioId.toString(),
    kind: document.kind,
    filename: document.filename,
    mime: document.mime,
    sizeBytes: document.sizeBytes,
    sha256: document.sha256,
    storageKey: document.storageKey,
    createdAt: document.createdAt,
  };
}
