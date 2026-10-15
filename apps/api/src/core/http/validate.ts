/**
 * The single request-validation middleware (`int-standards.express.md` → Input validation).
 *
 * Parses one part of the request with a zod schema. On success the parsed value — with zod's
 * coercions, defaults and stripped unknown keys applied — is stored on `req.validated*` for the
 * controller. On failure it forwards a `ValidationError` listing every failing path, so the
 * controller is never invoked (`monorepo-foundation.AC8`).
 */
import type { RequestHandler } from 'express';
import type { z } from 'zod';

import { ValidationError, type ValidationIssue } from '../errors/index.js';
import './request-context.js';

/** The request part a schema validates. */
export type RequestSource = 'body' | 'query' | 'params';

/** Where each source's parsed value is stored on the request. */
const TARGET_FIELD = {
  body: 'validatedBody',
  query: 'validatedQuery',
  params: 'validatedParams',
} as const satisfies Record<RequestSource, keyof Express.Request>;

/**
 * Builds a middleware that validates `req[source]` against `schema`.
 *
 * @param schema - Usually imported from `packages/contracts` via the module's `<name>.types.ts`.
 * @param source - The request part to validate; defaults to the JSON body.
 */
export function validate(schema: z.ZodType, source: RequestSource = 'body'): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      next(new ValidationError(result.error.issues.map(toValidationIssue)));
      return;
    }

    req[TARGET_FIELD[source]] = result.data;
    next();
  };
}

function toValidationIssue(issue: z.core.$ZodIssue): ValidationIssue {
  return { path: issue.path.map(String).join('.'), message: issue.message };
}
