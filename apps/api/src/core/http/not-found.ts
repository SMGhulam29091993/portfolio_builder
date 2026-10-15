/**
 * Catch-all for unmatched routes. Mounted after every router under `/api/v1`, so any path that
 * reaches it answers 404 `NOT_FOUND` in the standard envelope (`monorepo-foundation.AC6`).
 */
import type { RequestHandler } from 'express';

import { NotFoundError } from '../errors/index.js';

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route not found'));
};
