/**
 * `IAssetService` — upload, list, read and delete (`media-assets.T04`; API01–API04), and the
 * `IAssetLookup` other modules validate asset ids with.
 *
 * Upload pipeline (nothing is buffered whole): read the first bytes → detect the type from them
 * (415 if the kind does not accept it) → stream head + rest through a size cap (413 the moment it
 * is crossed) into `IFileStorage` under a random key, which hashes as it writes → dedupe by
 * `sha256` + kind within the portfolio → metadata. Any failure removes the partial object.
 *
 * Delete asks every `IAssetReferenceProvider`; one that throws fails the delete (fail closed),
 * and bytes go before metadata, so a failed byte delete leaves the asset intact.
 *
 * Filenames and contents are never logged; the service takes no logger.
 */
import { randomBytes } from 'node:crypto';
import { PassThrough, Transform, type Readable } from 'node:stream';

import {
  ConflictError,
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../core/errors/index.js';
import type {
  IAssetLookup,
  IAssetReferenceProvider,
  IAssetRepository,
  IAssetService,
  IContentTypeDetector,
  IFileStorage,
} from './assets.interface.js';
import {
  ASSET_FILENAME_MAX_LENGTH,
  ASSET_RULES,
  type AssetKind,
  type AssetUpload,
  type OpenedAsset,
  type StoredAsset,
  type UploadResult,
} from './assets.types.js';

/** Bytes read before detection: enough for every signature the detector checks. */
const HEAD_BYTES = 12;

/** Storage keys: 16 random bytes, hex. */
const KEY_BYTES = 16;

/** Thrown inside the size cap; mapped to 413 once storage has cleaned up. */
class SizeLimitExceeded extends Error {}

export class AssetService implements IAssetService, IAssetLookup {
  constructor(
    private readonly assets: IAssetRepository,
    private readonly storage: IFileStorage,
    private readonly detector: IContentTypeDetector,
    private readonly providers: readonly IAssetReferenceProvider[],
  ) {}

  async upload({ portfolioId, kind, filename, stream }: AssetUpload): Promise<UploadResult> {
    const rules = ASSET_RULES[kind];
    const head = await readHead(stream, HEAD_BYTES);
    if (head.length === 0) {
      stream.resume();
      throw new ValidationError([{ path: 'file', message: 'The file is empty' }]);
    }
    const mime = this.detector.detect(head);
    if (!mime || !rules.mime.includes(mime)) {
      stream.resume();
      throw new UnsupportedMediaTypeError(rules.mime);
    }

    const storageKey = randomBytes(KEY_BYTES).toString('hex');
    const source = new PassThrough();
    source.write(head);
    stream.pipe(source);
    let stored;
    try {
      stored = await this.storage.put(storageKey, source.pipe(sizeCap(rules.maxBytes)));
    } catch (error) {
      stream.resume();
      if (error instanceof SizeLimitExceeded) throw new PayloadTooLargeError(rules.maxBytes);
      throw error;
    }

    const existing = await this.assets.findByHash(portfolioId, stored.sha256, kind);
    if (existing) {
      await this.storage.delete(storageKey);
      return { asset: existing, created: false };
    }
    try {
      const asset = await this.assets.create({
        portfolioId,
        kind,
        filename: sanitizeFilename(filename),
        mime,
        sizeBytes: stored.sizeBytes,
        sha256: stored.sha256,
        storageKey,
      });
      return { asset, created: true };
    } catch (error) {
      await this.storage.delete(storageKey);
      // A parallel identical upload won: answer with its asset (Edge Cases).
      if (error instanceof ConflictError && error.code === 'ASSET_EXISTS') {
        const winner = await this.assets.findByHash(portfolioId, stored.sha256, kind);
        if (winner) return { asset: winner, created: false };
      }
      throw error;
    }
  }

  async list(portfolioId: string, kind?: AssetKind): Promise<{ asset: StoredAsset; inUse: boolean }[]> {
    const assets = await this.assets.list(portfolioId, kind);
    return Promise.all(
      assets.map(async (asset) => ({ asset, inUse: (await this.usedBy(asset)).length > 0 })),
    );
  }

  async inUse(portfolioId: string, assetId: string): Promise<boolean> {
    const asset = await this.requireAsset(portfolioId, assetId);
    return (await this.usedBy(asset)).length > 0;
  }

  async delete(portfolioId: string, assetId: string): Promise<void> {
    const asset = await this.requireAsset(portfolioId, assetId);
    const usedBy = await this.usedBy(asset);
    if (usedBy.length > 0) {
      throw new ConflictError('ASSET_IN_USE', { usedBy }, 'This file is in use and cannot be deleted');
    }
    await this.storage.delete(asset.storageKey);
    await this.assets.delete(portfolioId, assetId);
  }

  async open(portfolioId: string, assetId: string): Promise<OpenedAsset> {
    const asset = await this.requireAsset(portfolioId, assetId);
    return { asset, stream: await this.storage.get(asset.storageKey) };
  }

  async kindOf(portfolioId: string, assetId: string): Promise<AssetKind | null> {
    return (await this.assets.findById(portfolioId, assetId))?.kind ?? null;
  }

  /** Labels of the providers referencing the asset. A provider that throws fails the call. */
  private async usedBy(asset: StoredAsset): Promise<string[]> {
    const answers = await Promise.all(
      this.providers.map(async (provider) =>
        (await provider.referencesAsset(asset.id, asset.portfolioId)) ? provider.label : null,
      ),
    );
    return answers.filter((label): label is string => label !== null);
  }

  private async requireAsset(portfolioId: string, assetId: string): Promise<StoredAsset> {
    const asset = await this.assets.findById(portfolioId, assetId);
    if (!asset) throw new NotFoundError();
    return asset;
  }
}

/**
 * Reads up to `count` bytes from the start of `stream` without losing them: the stream is
 * paused afterwards and the caller writes the head back in front of the rest.
 */
function readHead(stream: Readable, count: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let length = 0;
    const done = () => {
      stream.off('data', onData);
      stream.off('end', done);
      stream.off('error', reject);
      stream.pause();
      const all = Buffer.concat(chunks);
      // Anything read past the head goes back to the front of the stream.
      if (all.length > count) stream.unshift(all.subarray(count));
      resolve(all.subarray(0, count));
    };
    const onData = (chunk: Buffer) => {
      chunks.push(chunk);
      length += chunk.length;
      if (length >= count) done();
    };
    stream.on('data', onData);
    stream.once('end', done);
    stream.once('error', reject);
  });
}

/** A pass-through that fails as soon as more than `maxBytes` have gone through. */
function sizeCap(maxBytes: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      seen += chunk.length;
      if (seen > maxBytes) callback(new SizeLimitExceeded());
      else callback(null, chunk);
    },
  });
}

/**
 * A safe base name (`media-assets.AC5`, `UT04`): no directories, no control or reserved
 * characters, at most 100 characters with the extension kept; never empty.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- removing control characters is the point.
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, '').replace(/^\.+/, '').trim();
  const fallback = cleaned.length > 0 ? cleaned : 'file';
  if (fallback.length <= ASSET_FILENAME_MAX_LENGTH) return fallback;
  const dot = fallback.lastIndexOf('.');
  const extension = dot > 0 && fallback.length - dot <= 10 ? fallback.slice(dot) : '';
  return fallback.slice(0, ASSET_FILENAME_MAX_LENGTH - extension.length) + extension;
}
