/**
 * Security response headers, set by `helmet` (`constitution.md` → Security hardening backlog).
 *
 * The API serves JSON only, so helmet's defaults apply unchanged — including a
 * Content-Security-Policy that would block any HTML an attacker managed to get rendered from an
 * API origin. Kept behind this factory so any future adjustment happens in one place.
 * First in the middleware chain (`architecture.md` → Request lifecycle).
 */
import helmet from 'helmet';
import type { RequestHandler } from 'express';

/** Builds the security-headers middleware. */
export function createSecurityHeaders(): RequestHandler {
  return helmet();
}
