/**
 * Fields the API's own middleware attaches to the Express request.
 *
 * Declared once here so every middleware and controller sees the same typed shape:
 * - `validatedBody` / `validatedQuery` / `validatedParams` — set by `validate()`; controllers
 *   read these and never re-parse the raw request (`int-standards.express.md` → Input validation).
 * - `requestId` — set by the request-id middleware (`monorepo-foundation.T05`) and included in
 *   every error log line.
 */
declare global {
  // Express exposes its request type through this global namespace; augmenting it is the
  // documented way to add fields, so the namespace rule does not apply here.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      validatedBody?: unknown;
      validatedQuery?: unknown;
      validatedParams?: unknown;
      requestId?: string;
    }
  }
}

export {};
