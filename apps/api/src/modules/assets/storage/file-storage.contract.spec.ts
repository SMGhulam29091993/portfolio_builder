/**
 * `media-assets.CT01` — the shared `IFileStorage` contract (AC12), run against GridFS on a real
 * `mongod` and the in-memory fake.
 */
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { NotFoundError } from '../../../core/errors/index.js';
import { InMemoryFileStorage, MongoTestHarness } from '../../../testing/index.js';
import type { IFileStorage } from '../assets.interface.js';
import { GridFsFileStorage } from './gridfs-file-storage.js';

let mongo: MongoTestHarness;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
});
afterEach(async () => {
  await mongo.reset();
});
afterAll(async () => {
  await mongo.stop();
});

async function read(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk as Buffer));
  return Buffer.concat(chunks);
}

describe.each([
  { name: 'GridFsFileStorage', create: (): IFileStorage => new GridFsFileStorage(mongo.connection) },
  { name: 'InMemoryFileStorage', create: (): IFileStorage => new InMemoryFileStorage() },
])('media-assets.CT01 — IFileStorage contract — $name', ({ create }) => {
  const bytes = Buffer.from(Array.from({ length: 300_000 }, (_, i) => i % 251));

  it('put returns size and SHA-256; get streams identical bytes', async () => {
    const storage = create();

    const stored = await storage.put('key-1', Readable.from([bytes.subarray(0, 1000), bytes.subarray(1000)]));

    expect(stored).toEqual({ sizeBytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
    expect((await read(await storage.get('key-1'))).equals(bytes)).toBe(true);
  });

  it('delete is idempotent and get after delete is NOT_FOUND', async () => {
    const storage = create();
    await storage.put('key-2', Readable.from([bytes]));

    await storage.delete('key-2');
    await storage.delete('key-2');

    await expect(storage.get('key-2')).rejects.toBeInstanceOf(NotFoundError);
    await expect(storage.get('never')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('a failing source leaves nothing behind', async () => {
    const storage = create();
    const failing = new Readable({
      read() {
        this.push(bytes.subarray(0, 100));
        this.destroy(new Error('client went away'));
      },
    });

    await expect(storage.put('key-3', failing)).rejects.toThrow();
    await expect(storage.get('key-3')).rejects.toBeInstanceOf(NotFoundError);
  });
});
