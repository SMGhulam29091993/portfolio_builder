/**
 * Gives every request an id that ties its log lines together (`int-standards.express.md` →
 * Logging). Second in the middleware chain (`architecture.md` → Request lifecycle), so every
 * later middleware and the error handler can read `req.requestId`.
 *
 * An incoming `X-Request-Id` is reused, so a caller (the Next.js server, a proxy) can correlate
 * its own logs with ours — but only when it matches a strict pattern. Anything else is replaced
 * with a fresh UUID, so a client cannot inject newlines or oversized values into log lines.
 */
import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

import './request-context.js';

/** Header read from the request and echoed on the response. */
export const REQUEST_ID_HEADER = 'X-Request-Id';

/** Accepted incoming ids: 1–128 characters of letters, digits, `-`, `_`, `.`. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Builds the request-id middleware.
 *
 * @param generateId - Source of new ids; injectable for deterministic tests.
 */
export function createRequestId(generateId: () => string = randomUUID): RequestHandler {
  return (req, res, next) => {
    const incoming = req.get(REQUEST_ID_HEADER);
    const requestId = incoming && SAFE_REQUEST_ID.test(incoming) ? incoming : generateId();

    req.requestId = requestId;
    res.set(REQUEST_ID_HEADER, requestId);
    next();
  };
}
