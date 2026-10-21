/**
 * Concrete `AppError` subclasses for the generic rows of the canonical error-code table
 * (`int-standards.express.md` → Error codes).
 *
 * Codes owned by a single feature are added by that feature next to its own code, not here:
 * `ORIGIN_NOT_ALLOWED` (`owner-auth`) is `OriginNotAllowedError` in
 * `core/http/origin-allow-list.middleware.ts`; `PUBLISH_BLOCKED` arrives with `publish-pipeline`.
 */
import { AppError } from './app-error.js';

/** One failing input location, as listed in a `VALIDATION_FAILED` response. */
export interface ValidationIssue {
  /** Dot-separated path to the failing field; empty for the input as a whole. */
  readonly path: string;
  readonly message: string;
}

/** 400 — the request input failed its schema, or the body was not parseable. */
export class ValidationError extends AppError {
  readonly status = 400;

  constructor(errors: readonly ValidationIssue[], message = 'Request validation failed') {
    super('VALIDATION_FAILED', message, { errors });
  }
}

/** 401 — no valid session. */
export class UnauthenticatedError extends AppError {
  readonly status = 401;

  constructor(message = 'Authentication required') {
    super('UNAUTHENTICATED', message);
  }
}

/** 404 — the route or the requested record does not exist. */
export class NotFoundError extends AppError {
  readonly status = 404;

  constructor(message = 'Resource not found') {
    super('NOT_FOUND', message);
  }
}

/**
 * 409 — the write conflicts with the current state. `code` is `REVISION_CONFLICT` or a
 * feature-specific code named by the owning spec.
 */
export class ConflictError extends AppError {
  readonly status = 409;

  constructor(
    code: string,
    details: Readonly<Record<string, unknown>> = {},
    message = 'Request conflicts with the current state',
  ) {
    super(code, message, details);
  }
}

/**
 * 402 — a paid action needs more credits than the user has (ADR-0012; `ai-design-studio.AC7`).
 * `creditsRequired` is what the action costs, `balance` what the user holds.
 */
export class CreditsRequiredError extends AppError {
  readonly status = 402;

  constructor(creditsRequired: number, balance: number, message = 'Not enough credits') {
    super('CREDITS_REQUIRED', message, { creditsRequired, balance });
  }
}

/** 413 — the request body is larger than the route accepts. */
export class PayloadTooLargeError extends AppError {
  readonly status = 413;

  constructor(maxBytes: number, message = 'Request body is too large') {
    super('PAYLOAD_TOO_LARGE', message, { maxBytes });
  }
}

/** 415 — the request content type is not accepted by the route. */
export class UnsupportedMediaTypeError extends AppError {
  readonly status = 415;

  constructor(allowed: readonly string[], message = 'Unsupported media type') {
    super('UNSUPPORTED_MEDIA_TYPE', message, { allowed });
  }
}

/** 429 — the client exceeded a rate limit. Also sets the `Retry-After` header. */
export class RateLimitedError extends AppError {
  readonly status = 429;

  constructor(retryAfterSec: number, message = 'Too many requests') {
    super('RATE_LIMITED', message, { retryAfterSec }, { 'Retry-After': String(retryAfterSec) });
  }
}

/**
 * 502 — an external provider failed. Adapters wrap the provider error as `cause` so it is
 * logged, while only the provider name reaches the client.
 */
export class UpstreamError extends AppError {
  readonly status = 502;

  constructor(provider: string, options?: ErrorOptions, message = 'Upstream provider failed') {
    super('UPSTREAM_FAILED', message, { provider }, {}, options);
  }
}

/** 503 — a dependency the request needs (e.g. MongoDB) is unavailable. */
export class ServiceUnavailableError extends AppError {
  readonly status = 503;

  constructor(
    details: Readonly<Record<string, unknown>> = {},
    message = 'Service unavailable',
    options?: ErrorOptions,
  ) {
    super('SERVICE_UNAVAILABLE', message, details, {}, options);
  }
}
