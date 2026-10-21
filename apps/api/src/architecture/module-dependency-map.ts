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
 *   - `portfolio`, `identity` and `design` → `publishing`, whose ports they implement
 *
 * `publishing` owns every port it shares with `portfolio` and `design` and imports neither
 * (ADR-0013), so the graph has no cycle. Its `/cms` router reads the portfolio id that
 * `resolvePortfolio` sets on the request through a global type augmentation, not an import.
 */
import type { DependencyMap, ImportAllowList } from './module-graph.js';

export const MODULE_DEPENDENCY_MAP: DependencyMap = {
  health: ['core'],
  auth: ['core'],
  portfolio: ['core', 'auth', 'publishing'],
  identity: ['core', 'assets', 'auth', 'portfolio', 'publishing'],
  assets: ['core', 'auth', 'portfolio'],
  design: ['core', 'auth', 'portfolio', 'publishing'],
  'ai-design': ['core', 'design', 'auth', 'portfolio'],
  publishing: ['core', 'assets', 'auth'],
  'public-site': ['core', 'publishing', 'assets'],
};

/**
 * Draft isolation at the interface level (`public-site-rendering` plan): of `publishing`, the
 * public site may import its read port and the published shapes only — never a draft
 * contributor, the pointer writer or the service.
 */
export const PUBLIC_SITE_IMPORTS: ImportAllowList = {
  from: 'public-site',
  to: 'publishing',
  names: ['ISnapshotReader', 'StoredSnapshot', 'PublishedContent', 'PublishedPortfolio'],
};
