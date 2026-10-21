/**
 * In-memory fakes of the `assets` module's storage and repository, for service tests. Each
 * passes its real counterpart's contract suite (`media-assets.CT01` for storage). Test-only.
 */
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import { Types } from 'mongoose';

import { ConflictError, NotFoundError } from '../../core/errors/index.js';
import type {
  AssetKind,
  IAssetRepository,
  IFileStorage,
  StoredAsset,
  StoredBytes,
} from '../../modules/assets/index.js';

export class InMemoryFileStorage implements IFileStorage {
  readonly objects = new Map<string, Buffer>();
  /** Keys deleted so far, in order — lets tests prove partial objects were cleaned up. */
  readonly deleted: string[] = [];

  async put(key: string, source: Readable): Promise<StoredBytes> {
    const chunks: Buffer[] = [];
    try {
      for await (const chunk of source) chunks.push(Buffer.from(chunk as Buffer));
    } catch (error) {
      await this.delete(key);
      throw error;
    }
    const bytes = Buffer.concat(chunks);
    this.objects.set(key, bytes);
    return { sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  }

  get(key: string): Promise<Readable> {
    const bytes = this.objects.get(key);
    if (!bytes) return Promise.reject(new NotFoundError());
    return Promise.resolve(Readable.from([bytes]));
  }

  delete(key: string): Promise<void> {
    this.deleted.push(key);
    this.objects.delete(key);
    return Promise.resolve();
  }
}

export class InMemoryAssetRepository implements IAssetRepository {
  private readonly assets = new Map<string, StoredAsset>();
  private tick = 0;

  // eslint-disable-next-line @typescript-eslint/require-await -- async so conflicts reject.
  async create(asset: Omit<StoredAsset, 'id' | 'createdAt'>): Promise<StoredAsset> {
    const duplicate = [...this.assets.values()].some(
      (stored) => stored.portfolioId === asset.portfolioId && stored.sha256 === asset.sha256 && stored.kind === asset.kind,
    );
    if (duplicate) throw new ConflictError('ASSET_EXISTS', {}, 'This file is already uploaded');
    this.tick += 1;
    const created: StoredAsset = {
      ...asset,
      id: new Types.ObjectId().toString(),
      createdAt: new Date(Date.UTC(2026, 0, 1) + this.tick * 1_000),
    };
    this.assets.set(created.id, created);
    return created;
  }

  findById(portfolioId: string, id: string): Promise<StoredAsset | null> {
    const found = this.assets.get(id);
    return Promise.resolve(found?.portfolioId === portfolioId ? found : null);
  }

  findByHash(portfolioId: string, sha256: string, kind: AssetKind): Promise<StoredAsset | null> {
    const found = [...this.assets.values()].find(
      (asset) => asset.portfolioId === portfolioId && asset.sha256 === sha256 && asset.kind === kind,
    );
    return Promise.resolve(found ?? null);
  }

  list(portfolioId: string, kind?: AssetKind): Promise<StoredAsset[]> {
    return Promise.resolve(
      [...this.assets.values()]
        .filter((asset) => asset.portfolioId === portfolioId && (!kind || asset.kind === kind))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    );
  }

  delete(portfolioId: string, id: string): Promise<boolean> {
    const found = this.assets.get(id);
    if (found?.portfolioId !== portfolioId) return Promise.resolve(false);
    this.assets.delete(id);
    return Promise.resolve(true);
  }
}

/** Minimal valid file headers for tests — never real documents (`media-assets.test_cases.md`). */
export const FIXTURE_HEADERS = Object.freeze({
  pdf: Buffer.from('%PDF-1.7\n%test fixture\n', 'latin1'),
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1]),
  webp: Buffer.from('RIFF\u0000\u0000\u0000\u0000WEBPVP8 ', 'latin1'),
  svg: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  html: Buffer.from('<!doctype html><html></html>'),
  exe: Buffer.from([0x4d, 0x5a, 0x90, 0, 3, 0, 0, 0, 4, 0, 0, 0]),
});

/** A fixture file of exactly `size` bytes starting with `header`. */
export function fixtureFile(header: Buffer, size = header.length + 64): Buffer {
  return Buffer.concat([header, Buffer.alloc(Math.max(0, size - header.length), 0x20)]);
}
