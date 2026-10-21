/**
 * MongoDB access for `snapshots` (`publish-pipeline.T01`; AC14, AC20). Append-only for content:
 * the only update touches `delivery`, and the only delete is the retention prune, whose filter
 * excludes the live snapshot and the newest `keep` versions.
 */
import { isValidObjectId } from 'mongoose';

import type { IMongoConnectionProvider } from '../../core/db/database-connection.interface.js';
import { ConflictError } from '../../core/errors/index.js';
import type { ISnapshotRepository } from './publishing.interface.js';
import { snapshotModel, type SnapshotDocument } from './snapshot.model.js';
import type {
  NewSnapshot,
  PublishedContent,
  RevalidationStatus,
  SnapshotHeader,
  StoredSnapshot,
} from './publishing.types.js';

const DUPLICATE_KEY = 11_000;

type LeanSnapshot = SnapshotDocument & { _id: { toString(): string } };

export class SnapshotRepository implements ISnapshotRepository {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async insert(snapshot: NewSnapshot): Promise<StoredSnapshot> {
    try {
      const created = await this.model().create({
        ...snapshot,
        delivery: { status: 'pending', at: null, attempts: 0 },
      });
      return toSnapshot(created.toObject());
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === DUPLICATE_KEY) {
        throw new ConflictError('SNAPSHOT_VERSION_TAKEN', { version: snapshot.version }, 'That version was just taken');
      }
      throw error;
    }
  }

  async latestVersion(portfolioId: string): Promise<number> {
    if (!isValidObjectId(portfolioId)) return 0;
    const latest = await this.model()
      .findOne({ portfolioId }, { version: 1 })
      .sort({ version: -1 })
      .lean<{ version: number }>()
      .exec();
    return latest?.version ?? 0;
  }

  async findById(portfolioId: string, snapshotId: string): Promise<StoredSnapshot | null> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(snapshotId)) return null;
    const found = await this.model().findOne({ _id: snapshotId, portfolioId }).lean<LeanSnapshot>().exec();
    return found ? toSnapshot(found) : null;
  }

  async findByVersion(portfolioId: string, version: number): Promise<StoredSnapshot | null> {
    if (!isValidObjectId(portfolioId)) return null;
    const found = await this.model().findOne({ portfolioId, version }).lean<LeanSnapshot>().exec();
    return found ? toSnapshot(found) : null;
  }

  async list(portfolioId: string, limit: number, beforeVersion?: number): Promise<SnapshotHeader[]> {
    if (!isValidObjectId(portfolioId)) return [];
    const filter = beforeVersion === undefined ? { portfolioId } : { portfolioId, version: { $lt: beforeVersion } };
    const rows = await this.model()
      .find(filter, { content: 0 })
      .sort({ version: -1 })
      .limit(limit)
      .lean<Omit<LeanSnapshot, 'content'>[]>()
      .exec();
    return rows.map(toHeader);
  }

  async updateDelivery(
    portfolioId: string,
    snapshotId: string,
    outcome: { status: RevalidationStatus; at: Date },
  ): Promise<boolean> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(snapshotId)) return false;
    // `delivery.*` only: the update document names no other field, so content cannot change here.
    const result = await this.model()
      .updateOne(
        { _id: snapshotId, portfolioId },
        { $set: { 'delivery.status': outcome.status, 'delivery.at': outcome.at }, $inc: { 'delivery.attempts': 1 } },
      )
      .exec();
    return result.matchedCount === 1;
  }

  async referencesAsset(portfolioId: string, assetId: string): Promise<boolean> {
    if (!isValidObjectId(portfolioId)) return false;
    return (await this.model().exists({ portfolioId, 'content.assets.id': assetId }).exec()) !== null;
  }

  async pruneOutsideWindow(portfolioId: string, keep: number, liveSnapshotId: string): Promise<number> {
    if (!isValidObjectId(portfolioId) || !isValidObjectId(liveSnapshotId)) return 0;
    const window = await this.model()
      .find({ portfolioId }, { version: 1 })
      .sort({ version: -1 })
      .skip(keep - 1)
      .limit(1)
      .lean<{ version: number }[]>()
      .exec();
    const oldestKept = window[0]?.version;
    if (oldestKept === undefined) return 0;
    const result = await this.model()
      .deleteMany({ portfolioId, version: { $lt: oldestKept }, _id: { $ne: liveSnapshotId } })
      .exec();
    return result.deletedCount;
  }

  private model() {
    return snapshotModel(this.connections.getConnection());
  }
}

function toHeader(document: Omit<LeanSnapshot, 'content'>): SnapshotHeader {
  return {
    id: document._id.toString(),
    portfolioId: document.portfolioId.toString(),
    version: document.version,
    contentHash: document.contentHash,
    note: document.note,
    publishedAt: document.publishedAt,
    publishedBy: document.publishedBy.toString(),
    delivery: { status: document.delivery.status, at: document.delivery.at, attempts: document.delivery.attempts },
  };
}

function toSnapshot(document: LeanSnapshot): StoredSnapshot {
  return { ...toHeader(document), content: document.content as PublishedContent };
}
