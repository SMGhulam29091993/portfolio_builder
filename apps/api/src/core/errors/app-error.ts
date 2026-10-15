/**
 * Base class for every error a service, middleware or adapter throws on purpose.
 *
 * An `AppError` carries everything the single error middleware needs to build the response —
 * HTTP status, canonical `data.code`, the extra `data` fields and any response headers — so no
 * layer below the controller ever builds an HTTP response itself
 * (`int-standards.express.md` → Errors). The codes and their extra fields are owned by
 * `int-standards.express.md` → Error codes; subclasses mirror that table and nothing else.
 *
 * Everything on an `AppError` is sent to the client, so a subclass must never put a secret,
 * driver message or stack trace into `message` or `details`.
 */
export abstract class AppError extends Error {
  /** HTTP status the error middleware responds with. */
  abstract readonly status: number;

  /**
   * @param code - Canonical `data.code` value, e.g. `NOT_FOUND`.
   * @param message - Human-readable, client-safe summary for the envelope's `message`.
   * @param details - Extra `data` fields for this code, e.g. `{ maxBytes }`.
   * @param headers - Response headers this error requires, e.g. `Retry-After`.
   * @param options - Standard `ErrorOptions`; `cause` is logged, never sent.
   */
  protected constructor(
    readonly code: string,
    message: string,
    readonly details: Readonly<Record<string, unknown>> = {},
    readonly headers: Readonly<Record<string, string>> = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}
