/**
 * `IFileStorage` on MongoDB GridFS, bucket `asset_files` (`media-assets.T02`; BRD-006: files live
 * in GridFS until an ADR approves another store). The only writer of `asset_files.*`.
 *
 * `put` hashes and counts the bytes as they stream into GridFS, so nothing is held whole in
 * memory. An object is addressed by its `filename` in the bucket, which is the storage key.
 */
import { createHash } from 'node:crypto';
import { Transform, type Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import mongoose from 'mongoose';

import type { IMongoConnectionProvider } from '../../../core/db/database-connection.interface.js';
import { NotFoundError } from '../../../core/errors/index.js';
import type { IFileStorage } from '../assets.interface.js';
import type { StoredBytes } from '../assets.types.js';

const BUCKET_NAME = 'asset_files';

export class GridFsFileStorage implements IFileStorage {
  constructor(private readonly connections: IMongoConnectionProvider) {}

  async put(key: string, source: Readable): Promise<StoredBytes> {
    const hash = createHash('sha256');
    let sizeBytes = 0;
    const meter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        hash.update(chunk);
        sizeBytes += chunk.length;
        callback(null, chunk);
      },
    });
    try {
      await pipeline(source, meter, this.bucket().openUploadStream(key));
    } catch (error) {
      // A failed or aborted write leaves no partial object behind (Error Handling).
      await this.delete(key);
      throw error;
    }
    return { sizeBytes, sha256: hash.digest('hex') };
  }

  async get(key: string): Promise<Readable> {
    const found = await this.bucket().find({ filename: key }).limit(1).toArray();
    if (found.length === 0) throw new NotFoundError();
    return this.bucket().openDownloadStreamByName(key);
  }

  async delete(key: string): Promise<void> {
    const found = await this.bucket().find({ filename: key }).toArray();
    for (const file of found) await this.bucket().delete(file._id);
  }

  private bucket(): mongoose.mongo.GridFSBucket {
    const db = this.connections.getConnection().db;
    if (!db) throw new Error('MongoDB is not connected');
    return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
  }
}
