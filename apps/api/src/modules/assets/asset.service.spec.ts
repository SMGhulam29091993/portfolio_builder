/**
 * `AssetService`, the detector and `sanitizeFilename` with fakes (`media-assets.UT01`–`UT08`).
 */
import { Readable } from 'node:stream';

import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  NotFoundError,
  PayloadTooLargeError,
  UnsupportedMediaTypeError,
  ValidationError,
} from '../../core/errors/index.js';
import { FIXTURE_HEADERS, fixtureFile, InMemoryAssetRepository, InMemoryFileStorage } from '../../testing/index.js';
import { MagicByteContentTypeDetector } from './adapters/magic-byte-content-type-detector.js';
import type { IAssetReferenceProvider } from './assets.interface.js';
import { AssetService, sanitizeFilename } from './asset.service.js';

const PORTFOLIO = new Types.ObjectId().toString();
const OTHER = new Types.ObjectId().toString();

class Provider implements IAssetReferenceProvider {
  readonly referenced = new Set<string>();
  fails = false;
  constructor(readonly label: string) {}
  referencesAsset(assetId: string): Promise<boolean> {
    if (this.fails) return Promise.reject(new Error('provider down'));
    return Promise.resolve(this.referenced.has(assetId));
  }
}

let storage: InMemoryFileStorage;
let assets: InMemoryAssetRepository;
let provider: Provider;
let service: AssetService;

beforeEach(() => {
  storage = new InMemoryFileStorage();
  assets = new InMemoryAssetRepository();
  provider = new Provider('draft identity');
  service = new AssetService(assets, storage, new MagicByteContentTypeDetector(), [provider]);
});

/** A stream delivering `bytes` in small chunks, as a network upload does. */
function streamOf(bytes: Buffer): Readable {
  const chunks: Buffer[] = [];
  for (let at = 0; at < bytes.length; at += 7) chunks.push(bytes.subarray(at, at + 7));
  return Readable.from(chunks);
}

function upload(bytes: Buffer, kind: 'resume' | 'image' = 'resume', portfolioId = PORTFOLIO, filename = 'cv.pdf') {
  return service.upload({ portfolioId, kind, filename, stream: streamOf(bytes) });
}

describe('MagicByteContentTypeDetector (media-assets.UT01)', () => {
  const detector = new MagicByteContentTypeDetector();
  it.each([
    ['pdf', 'application/pdf'],
    ['png', 'image/png'],
    ['jpeg', 'image/jpeg'],
    ['webp', 'image/webp'],
    ['svg', undefined],
    ['html', undefined],
    ['exe', undefined],
  ] as const)('%s → %s', (name, mime) => {
    expect(detector.detect(FIXTURE_HEADERS[name])).toBe(mime);
  });
});

describe('sanitizeFilename (media-assets.UT04)', () => {
  it.each([
    ['../../a/b.pdf', 'b.pdf'],
    ['..\\..\\x.pdf', 'x.pdf'],
    ['bad\u0000na\u001fme.pdf', 'badname.pdf'],
    ['.hidden', 'hidden'],
    ['', 'file'],
  ])('%j → %j', (input, output) => {
    expect(sanitizeFilename(input)).toBe(output);
  });

  it('cuts a long name without a short extension to exactly 100 characters', () => {
    expect(sanitizeFilename('x'.repeat(150))).toBe('x'.repeat(100));
    expect(sanitizeFilename(`${'y'.repeat(120)}.averyveryverylongextension`)).toHaveLength(100);
  });

  it('cuts a long name to 100 characters, keeping the extension', () => {
    const cut = sanitizeFilename(`${'n'.repeat(300)}.pdf`);
    expect(cut).toHaveLength(100);
    expect(cut.endsWith('.pdf')).toBe(true);
  });
});

describe('upload', () => {
  it('media-assets.AC1 — stores a PDF with its detected type, size and hash', async () => {
    const pdf = fixtureFile(FIXTURE_HEADERS.pdf, 500);

    const { asset, created } = await upload(pdf);

    expect(created).toBe(true);
    expect(asset).toMatchObject({ kind: 'resume', mime: 'application/pdf', sizeBytes: 500, filename: 'cv.pdf' });
    expect(storage.objects.get(asset.storageKey)?.equals(pdf)).toBe(true);
  });

  it('media-assets.UT02 / AC2 — PNG bytes as a résumé are 415 and nothing is kept', async () => {
    await expect(upload(fixtureFile(FIXTURE_HEADERS.png))).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
    expect(storage.objects.size).toBe(0);
    await expect(assets.list(PORTFOLIO)).resolves.toEqual([]);
  });

  it('media-assets.AC3 — SVG, HTML and executables are 415 for both kinds', async () => {
    for (const name of ['svg', 'html', 'exe'] as const) {
      for (const kind of ['resume', 'image'] as const) {
        await expect(upload(fixtureFile(FIXTURE_HEADERS[name]), kind)).rejects.toBeInstanceOf(UnsupportedMediaTypeError);
      }
    }
  });

  it('media-assets.UT03 / AC4 — over the limit is 413 and the partial object is deleted', async () => {
    const tooBig = fixtureFile(FIXTURE_HEADERS.png, 2 * 1024 * 1024 + 1);

    await expect(upload(tooBig, 'image')).rejects.toBeInstanceOf(PayloadTooLargeError);
    expect(storage.objects.size).toBe(0);
    expect(storage.deleted).toHaveLength(1);
  });

  it('accepts a file exactly at the limit', async () => {
    await expect(upload(fixtureFile(FIXTURE_HEADERS.png, 2 * 1024 * 1024), 'image')).resolves.toMatchObject({ created: true });
  });

  it('an empty file is 400', async () => {
    await expect(upload(Buffer.alloc(0))).rejects.toBeInstanceOf(ValidationError);
  });

  it('media-assets.UT05 / AC6 — the same bytes again return the existing asset; one copy kept', async () => {
    const pdf = fixtureFile(FIXTURE_HEADERS.pdf);
    const first = await upload(pdf);

    const second = await upload(pdf, 'resume', PORTFOLIO, 'again.pdf');

    expect(second).toEqual({ asset: first.asset, created: false });
    expect(storage.objects.size).toBe(1);
  });

  it('media-assets.AC13 — the same bytes in another portfolio are that portfolio\'s own asset', async () => {
    const pdf = fixtureFile(FIXTURE_HEADERS.pdf);
    const mine = await upload(pdf);

    const theirs = await upload(pdf, 'resume', OTHER);

    expect(theirs.created).toBe(true);
    expect(theirs.asset.id).not.toBe(mine.asset.id);
    await expect(service.kindOf(OTHER, mine.asset.id)).resolves.toBeNull();
    await expect(service.open(OTHER, mine.asset.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.delete(OTHER, mine.asset.id)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('list, delete, lookup', () => {
  it('media-assets.AC7 — filters by kind, newest first, with inUse', async () => {
    const pdf = await upload(fixtureFile(FIXTURE_HEADERS.pdf));
    const png = await upload(fixtureFile(FIXTURE_HEADERS.png), 'image', PORTFOLIO, 'a.png');
    provider.referenced.add(pdf.asset.id);

    const all = await service.list(PORTFOLIO);
    expect(all.map(({ asset, inUse }) => [asset.id, inUse])).toEqual([
      [png.asset.id, false],
      [pdf.asset.id, true],
    ]);
    expect((await service.list(PORTFOLIO, 'image')).map(({ asset }) => asset.id)).toEqual([png.asset.id]);
  });

  it('media-assets.UT06 / AC8 — an unreferenced asset loses bytes then metadata', async () => {
    const { asset } = await upload(fixtureFile(FIXTURE_HEADERS.pdf));

    await service.delete(PORTFOLIO, asset.id);

    expect(storage.objects.size).toBe(0);
    await expect(service.open(PORTFOLIO, asset.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('media-assets.UT07 / AC9 — a referenced asset is ASSET_IN_USE naming the provider', async () => {
    const { asset } = await upload(fixtureFile(FIXTURE_HEADERS.pdf));
    provider.referenced.add(asset.id);

    await expect(service.delete(PORTFOLIO, asset.id)).rejects.toMatchObject({
      code: 'ASSET_IN_USE',
      details: { usedBy: ['draft identity'] },
    });
    expect(storage.objects.size).toBe(1);
  });

  it('media-assets.UT08 — a provider that throws fails the delete; nothing removed', async () => {
    const { asset } = await upload(fixtureFile(FIXTURE_HEADERS.pdf));
    provider.fails = true;

    await expect(service.delete(PORTFOLIO, asset.id)).rejects.toThrow('provider down');
    expect(storage.objects.size).toBe(1);
  });

  it('kindOf reports the kind or null', async () => {
    const { asset } = await upload(fixtureFile(FIXTURE_HEADERS.pdf));

    await expect(service.kindOf(PORTFOLIO, asset.id)).resolves.toBe('resume');
    await expect(service.kindOf(PORTFOLIO, new Types.ObjectId().toString())).resolves.toBeNull();
  });
});

describe('upload failure paths', () => {
  it('a parallel identical upload that wins the race is returned; our copy is removed', async () => {
    const pdf = fixtureFile(FIXTURE_HEADERS.pdf);
    // The hash lookup misses (as if the other request had not committed yet), then the insert
    // hits the unique index because the other one just did.
    const winner = await assets.create({
      portfolioId: PORTFOLIO,
      kind: 'resume',
      filename: 'first.pdf',
      mime: 'application/pdf',
      sizeBytes: pdf.length,
      sha256: (await new InMemoryFileStorage().put('x', streamOf(pdf))).sha256,
      storageKey: 'winner-key',
    });
    const realFind = assets.findByHash.bind(assets);
    let calls = 0;
    assets.findByHash = (...args) => {
      calls += 1;
      return calls === 1 ? Promise.resolve(null) : realFind(...args);
    };

    await expect(upload(pdf)).resolves.toEqual({ asset: winner, created: false });
    expect(storage.objects.size).toBe(0);
  });

  it('a storage failure other than the size cap propagates and keeps nothing', async () => {
    storage.put = () => Promise.reject(new Error('disk full'));

    await expect(upload(fixtureFile(FIXTURE_HEADERS.pdf))).rejects.toThrow('disk full');
    await expect(assets.list(PORTFOLIO)).resolves.toEqual([]);
  });

  it('a metadata failure other than a duplicate removes the stored bytes and propagates', async () => {
    assets.create = () => Promise.reject(new Error('db down'));

    await expect(upload(fixtureFile(FIXTURE_HEADERS.pdf))).rejects.toThrow('db down');
    expect(storage.objects.size).toBe(0);
  });

  it('inUse answers per asset and 404s for an unknown one', async () => {
    const { asset } = await upload(fixtureFile(FIXTURE_HEADERS.pdf));
    provider.referenced.add(asset.id);

    await expect(service.inUse(PORTFOLIO, asset.id)).resolves.toBe(true);
    await expect(service.inUse(PORTFOLIO, new Types.ObjectId().toString())).rejects.toBeInstanceOf(NotFoundError);
  });
});
