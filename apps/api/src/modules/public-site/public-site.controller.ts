/**
 * HTTP in/out for the public site (`public-site-rendering.T01`; API01, API02, API04). Conditional
 * GET is answered here: the ETag is the content hash (API01) or the file's SHA-256 (API02), and a
 * matching `If-None-Match` is a bodiless 304.
 */
import type { Request, RequestHandler, Response } from 'express';
import type { Readable } from 'node:stream';

import { ok } from '../../core/http/index.js';
import type { IPublicSiteService } from './public-site.interface.js';

/** API01: cacheable, but always revalidated, so a publish shows at once (spec → API01). */
const PORTFOLIO_CACHE = 'public, max-age=0, must-revalidate';
/** API02: a published file changes only with a new id, so an hour is safe. */
const ASSET_CACHE = 'public, max-age=3600';

export class PublicSiteController {
  constructor(private readonly site: IPublicSiteService) {}

  /** `GET /api/v1/public/portfolios/:slug` — `public-site-rendering.API01`. */
  readonly portfolio: RequestHandler = async (req, res) => {
    const { slug } = req.validatedParams as { slug: string };
    const current = await this.site.current(slug);
    if (notModified(req, res, current.contentHash, PORTFOLIO_CACHE)) return;
    ok(res, 'ok', {
      slug: current.slug,
      version: current.version,
      publishedAt: current.publishedAt.toISOString(),
      content: current.content,
    });
  };

  /** `GET /api/v1/public/portfolios/:slug/assets/:id/:filename` — `public-site-rendering.API02`. */
  readonly asset: RequestHandler = async (req, res) => {
    const { slug, id, filename } = req.validatedParams as { slug: string; id: string; filename: string };
    const { asset, stream } = await this.site.asset(slug, id, filename);
    if (notModified(req, res, asset.sha256, ASSET_CACHE)) {
      stream.destroy();
      return;
    }
    res.setHeader('Content-Type', asset.mime);
    res.setHeader('Content-Length', String(asset.sizeBytes));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${asset.filename.replace(/["\\\r\n]/g, '_')}"`);
    await streamTo(stream, res);
  };

  /** `GET /api/v1/public/portfolios` — `public-site-rendering.API04`. */
  readonly published: RequestHandler = async (_req, res) => {
    const portfolios = await this.site.published();
    ok(res, 'ok', { portfolios: portfolios.map(({ slug, publishedAt }) => ({ slug, publishedAt: publishedAt.toISOString() })) });
  };
}

/** Sets the ETag and cache headers; answers 304 when the client already has this version. */
function notModified(req: Request, res: Response, hash: string, cacheControl: string): boolean {
  const etag = `"${hash}"`;
  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', cacheControl);
  const header = req.headers['if-none-match'];
  if (!header) return false;
  const matches = header === '*' || header.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag);
  if (matches) res.status(304).end();
  return matches;
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
