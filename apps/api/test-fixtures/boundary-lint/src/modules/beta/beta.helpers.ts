/**
 * Fixture: per-request helpers of module `beta` — neither a service, repository, controller nor
 * adapter, so a module may create them where it needs them (as `assets` will a size-limit stream).
 */
export class BetaBuffer {
  readonly chunks: string[] = [];
}

/** Module-specific errors are thrown with `new` inside services. */
export class BetaNotFoundError extends Error {}
