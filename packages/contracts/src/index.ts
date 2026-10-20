/**
 * Public surface of `@portfolio/contracts`.
 *
 * Owns every request/response schema and every section payload schema (zod), plus the types
 * inferred from them — the single definition `apps/api` validates with and `apps/web` forms
 * reuse (`architecture.md` → Shared packages). One folder per area; `common/` holds the shared payload
 * primitives (`plainText`).
 */
export * from './assets/index.js';
export * from './auth/index.js';
export * from './common/index.js';
export * from './design/index.js';
export * from './health/index.js';
export * from './identity/index.js';
export * from './publishing/index.js';
export * from './sections/index.js';
