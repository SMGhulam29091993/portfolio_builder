/**
 * Public surface of `@portfolio/contracts`.
 *
 * Owns every request/response schema and every section payload schema (zod), plus the types
 * inferred from them — the single definition `apps/api` validates with and `apps/web` forms
 * reuse (`architecture.md` → Shared packages). One folder per area; shared payload primitives
 * arrive with `section-engine`.
 */
export * from './auth/index.js';
export * from './health/index.js';
//# sourceMappingURL=index.d.ts.map