/**
 * HTTP in/out for assets (`media-assets.T05`; API01–API04). Multipart is parsed here, on the
 * upload route only, by `busboy` streaming the file part straight into `IAssetService.upload`
 * (`int-standards.express.md` → Multipart). Every handler reads the portfolio from
 * `req.portfolio`, so a user only ever reaches their own assets (`media-assets.AC13`).
 */
import type { Readable } from 'node:stream';

import busboy from 'busboy';
import type { Request, RequestHandler, Response } from 'express';

import { UnauthenticatedError, ValidationError } from '../../core/errors/index.js';
import { created, ok } from '../../core/http/index.js';
import type { IAssetService } from './assets.interface.js';
import {
  ASSET_RULES,
  assetKindSchema,
  type AssetKind,
  type AssetReference,
  type ListAssetsQuery,
  type StoredAsset,
  type UploadResult,
} from './assets.types.js';

/** busboy's own cap, a second line behind the per-kind size cap: the largest kind, plus one. */
const MULTIPART_FILE_LIMIT = Math.max(...Object.values(ASSET_RULES).map((rule) => rule.maxBytes)) + 1;

export class AssetController {
  constructor(private readonly assets: IAssetService) {}

  /** `POST /api/v1/cms/assets` — `media-assets.API01`. Fields: `kind` (first), then `file`. */
  readonly upload: RequestHandler = async (req, res) => {
    const portfolioId = portfolioIdOf(req);
    const result = await parseUpload(req, (kind, filename, stream) =>
      this.assets.upload({ portfolioId, kind, filename, stream }),
    );
    const body = { asset: await this.reference(result.asset, portfolioId) };
    if (result.created) created(res, 'File uploaded', body);
    else ok(res, 'This file was already uploaded', body);
  };

  /** `GET /api/v1/cms/assets?kind=` — `media-assets.API02`. */
  readonly list: RequestHandler = async (req, res) => {
    const { kind } = req.validatedQuery as ListAssetsQuery;
    const listed = await this.assets.list(portfolioIdOf(req), kind);
    ok(res, 'Assets', { assets: listed.map(({ asset, inUse }) => toReference(asset, inUse)) });
  };

  /** `DELETE /api/v1/cms/assets/:id` — `media-assets.API03`. */
  readonly remove: RequestHandler = async (req, res) => {
    await this.assets.delete(portfolioIdOf(req), idOf(req));
    ok(res, 'File deleted', { deleted: true });
  };

  /** `GET /api/v1/cms/assets/:id/content` — `media-assets.API04`. Owner-only, never cached. */
  readonly content: RequestHandler = async (req, res) => {
    const { asset, stream } = await this.assets.open(portfolioIdOf(req), idOf(req));
    res.status(200);
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('Content-Length', String(asset.sizeBytes));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    await streamTo(stream, res);
  };

  private async reference(asset: StoredAsset, portfolioId: string): Promise<AssetReference> {
    return toReference(asset, await this.assets.inUse(portfolioId, asset.id));
  }
}

function toReference(asset: StoredAsset, inUse: boolean): AssetReference {
  return {
    id: asset.id,
    kind: asset.kind,
    filename: asset.filename,
    mime: asset.mime,
    sizeBytes: asset.sizeBytes,
    sha256: asset.sha256,
    createdAt: asset.createdAt.toISOString(),
    inUse,
  };
}

/**
 * Parses `multipart/form-data` with exactly one `kind` field before exactly one `file` part, and
 * hands the file stream to `onFile` while it is still arriving. Every malformed shape is one 400.
 */
function parseUpload(
  req: Request,
  onFile: (kind: AssetKind, filename: string, stream: Readable) => Promise<UploadResult>,
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    let parser: busboy.Busboy;
    try {
      parser = busboy({
        headers: req.headers,
        limits: { files: 1, fields: 4, fileSize: MULTIPART_FILE_LIMIT, fieldSize: 64 },
      });
    } catch {
      reject(invalid('file', 'Send the file as multipart/form-data'));
      return;
    }
    let kind: AssetKind | undefined;
    let handled: Promise<UploadResult> | undefined;
    let failed = false;
    const fail = (error: unknown) => {
      if (failed) return;
      failed = true;
      req.unpipe(parser);
      req.resume();
      reject(error instanceof Error ? error : new Error('Upload failed'));
    };

    parser.on('field', (name, value) => {
      if (name !== 'kind') return;
      const parsed = assetKindSchema.safeParse(value);
      if (parsed.success) kind = parsed.data;
    });
    parser.on('file', (name, stream, info) => {
      if (name !== 'file' || handled) {
        stream.resume();
        return;
      }
      if (!kind) {
        stream.resume();
        fail(invalid('kind', 'Send kind (resume or image) before the file'));
        return;
      }
      handled = onFile(kind, info.filename, stream);
      handled.catch(fail);
    });
    parser.on('filesLimit', () => {
      fail(invalid('file', 'Send exactly one file'));
    });
    parser.on('error', fail);
    parser.on('close', () => {
      if (failed) return;
      if (!handled) {
        fail(invalid(kind ? 'file' : 'kind', kind ? 'Missing file' : 'Missing or unknown kind'));
        return;
      }
      handled.then(resolve, fail);
    });
    req.pipe(parser);
  });
}

function invalid(path: string, message: string): ValidationError {
  return new ValidationError([{ path, message }]);
}

function streamTo(stream: Readable, res: Response): Promise<void> {
  return new Promise((resolve, reject) => {
    stream.on('error', reject);
    res.on('finish', () => {
      resolve();
    });
    stream.pipe(res);
  });
}

function portfolioIdOf(req: Request): string {
  if (!req.portfolio) throw new UnauthenticatedError();
  return req.portfolio.portfolioId;
}

function idOf(req: Request): string {
  return (req.validatedParams as { id: string }).id;
}
