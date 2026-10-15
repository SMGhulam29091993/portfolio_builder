/**
 * The single error middleware, registered last in the app (`int-standards.express.md` → Errors).
 *
 * - `AppError` → its status, canonical code, details and headers.
 * - Body-parser failures → `VALIDATION_FAILED` (malformed JSON) or `PAYLOAD_TOO_LARGE`.
 * - Anything else → 500 `INTERNAL_ERROR` with a fixed message. The original error, with its
 *   stack, goes only to the log, tagged with the request id (`monorepo-foundation.AC7`).
 *
 * Express 5 forwards rejected promises from async handlers here on its own, so handlers carry
 * no `try/catch` wrappers.
 */
import type { ErrorRequestHandler, Request } from 'express';

import {
  AppError,
  PayloadTooLargeError,
  ValidationError,
} from '../errors/index.js';
import type { ILogger } from '../logger/logger.interface.js';
import { JSON_BODY_LIMIT_BYTES } from './json-body.js';
import { fail } from './respond.js';
import './request-context.js';

/** Fixed, client-safe message for unexpected failures. */
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/** The subset of a body-parser (`http-errors`) error this middleware reads. */
interface BodyParserError {
  readonly type: string;
  readonly limit?: number;
}

/**
 * Builds the error middleware.
 *
 * @param logger - Receives unexpected errors and 5xx `AppError`s.
 */
export function createErrorHandler(logger: ILogger): ErrorRequestHandler {
  // Express identifies error middleware by its four declared parameters.
  return (error: unknown, req, res, next) => {
    // The response is already streaming: only Express's default handler can end it safely.
    if (res.headersSent) {
      next(error);
      return;
    }

    const appError = toAppError(error);

    if (!appError) {
      logger.error('unhandled error', { ...requestFields(req), error });
      fail(res, 500, INTERNAL_ERROR_MESSAGE, { code: 'INTERNAL_ERROR' });
      return;
    }

    if (appError.status >= 500) {
      logger.error('request failed', { ...requestFields(req), code: appError.code, error });
    }

    res.set(appError.headers);
    fail(res, appError.status, appError.message, { ...appError.details, code: appError.code });
  };
}

/** Returns the `AppError` an error stands for, or `undefined` when it is unexpected. */
function toAppError(error: unknown): AppError | undefined {
  if (error instanceof AppError) return error;
  if (!isBodyParserError(error)) return undefined;

  switch (error.type) {
    case 'entity.parse.failed':
      return new ValidationError([{ path: '', message: 'Malformed JSON body' }]);
    case 'entity.too.large':
      return new PayloadTooLargeError(error.limit ?? JSON_BODY_LIMIT_BYTES);
    default:
      return undefined;
  }
}

function isBodyParserError(error: unknown): error is BodyParserError {
  return (
    error instanceof Error &&
    'type' in error &&
    typeof error.type === 'string' &&
    error.type.startsWith('entity.')
  );
}

/**
 * Request fields included in error logs. `path` excludes the query string, which can carry
 * tokens (`constitution.md` → PII / logging rules).
 */
function requestFields(req: Request): Record<string, unknown> {
  return { requestId: req.requestId, method: req.method, path: req.path };
}
