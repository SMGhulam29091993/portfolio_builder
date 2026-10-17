/**
 * `.ai-context/architecture.md` → Module dependency map, as data for the architecture test.
 *
 * That document is the canonical owner of the allowed edges (`ownership_index.md`); this table
 * mirrors it so the boundary is enforced, not only documented. **Change both in the same
 * change** — `.agent/workflows/code-review.md` checks it, and `architecture.spec.ts` checks that
 * the module list here equals the one in `architecture.md` → API modules.
 *
 * Every edge is listed as written in the map, including:
 *   - the `/cms` router edges — every module with a `/cms` router may depend on `auth`
 *     (`requireOwner`) and `portfolio` (`resolvePortfolio`)
 *   - `portfolio`, `identity` and `design` → `publishing`, whose `IDraftContributor` they implement
 *
 * As written, the map allows `portfolio ↔ publishing` and `design ↔ publishing` both ways, which
 * the constitution's DAG rule forbids in the actual graph (`findCycles`). No code takes either
 * edge yet; the contradiction is recorded in `.ai-context/state/blockers.md` and must be settled
 * before `publish-pipeline.T02` adds them.
 */
import type { DependencyMap } from './module-graph.js';

export const MODULE_DEPENDENCY_MAP: DependencyMap = {
  health: ['core'],
  auth: ['core'],
  portfolio: ['core', 'auth', 'publishing'],
  identity: ['core', 'assets', 'auth', 'portfolio', 'publishing'],
  assets: ['core', 'auth', 'portfolio'],
  design: ['core', 'auth', 'portfolio', 'publishing'],
  'ai-design': ['core', 'design', 'auth', 'portfolio'],
  publishing: ['core', 'portfolio', 'assets', 'design', 'auth'],
  'public-site': ['core', 'publishing', 'assets'],
};
