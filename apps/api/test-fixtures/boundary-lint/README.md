# Boundary-lint fixtures

Inputs for `monorepo-foundation.IT10` (`apps/api/src/architecture/boundary-lint.spec.ts`).

This folder mirrors the shape of `apps/api/src` — `core/`, `config/`, `container.ts` and two fake
modules, `alpha` and `beta` — so the API's real ESLint config treats each file as it would treat
real source. It is not part of the API:

- `apps/api/tsconfig.json` does not include it, so it is never typechecked or built. Its own
  `tsconfig.json` exists only so type-aware lint rules can resolve a program for it.
- `apps/api/eslint.config.js` ignores it; the spec lints it with ignores switched off.

| File | Expected `portfolio/*` result |
|---|---|
| `src/modules/beta/violates-module-boundary.ts` | `module-boundary` × 3 (import, re-export, dynamic import) |
| `src/modules/beta/beta.service.ts` | `no-framework-in-service` × 2 (`mongoose`, `express`) |
| `src/modules/beta/violates-process-env.ts` | `no-process-env` × 3 (member access, destructuring, `node:process` import) |
| `src/modules/beta/violates-instantiation.ts` | `no-instantiation-outside-container` × 2 (repository, adapter) |
| `src/modules/beta/conforms.ts` | none — the legal counterpart of every case above |
| `src/container.ts`, `src/config/env.ts`, `src/modules/beta/beta.repository.spec.ts` | none — the exempt files |

Each violation file breaks exactly one rule, so a failure points at one rule.
