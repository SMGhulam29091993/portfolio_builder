# Plan: Publish Pipeline
## Derived From
.ai-context/specs/publish-pipeline.spec.md
## Architecture Approach
Module `apps/api/src/modules/publishing/`, module file pattern plus `rules/`, `steps/`, `listeners/`.
| Class | Role | Implements | Depends on (interfaces) |
|---|---|---|---|
| `PublishingController` | Controller | — | `IPublishingService` |
| `PublishingService` | Service | `IPublishingService`, `ISnapshotReader` | `ISnapshotRepository`, `IDraftAssembler`, `IPublishPipeline`, `IPublishedPointerWriter`, `IPublishedPointerReader`, `IEventPublisher` |
| `DraftAssembler` | Service | `IDraftAssembler` | `IDraftContributor[]`, `ISnapshotBuilder` |
| `SnapshotBuilder` | **Builder** | `ISnapshotBuilder` | `IAssetLookup`, `ICanonicalHasher` |
| `PublishPipeline` | **Pipeline** | `IPublishPipeline` | `IPublishStep[]` (ordered, constructor) |
| `ValidateStep`, `PersistSnapshotStep`, `ActivateStep`, `PruneSnapshotsStep`, `EmitPublishedStep` | Steps | `IPublishStep` | their own narrow dependencies (prune added 2026-10-21 for ADR-0004 retention, AC20) |
| `PublishRuleRegistry` + nine rule classes | **Strategy + Registry** | `IPublishRule` | `IDesignValidator`, `IAssetLookup` where needed |
| `SnapshotRepository` | Repository | `ISnapshotRepository` (insert / reads / update delivery / retention prune) | Mongoose model |
| `SiteRevalidationListener` | **Observer** | `IEventHandler` (`core/events`) | `IRevalidationClient`, `ISnapshotRepository` |
| `HttpRevalidationClient`, `NoopRevalidationClient` | Adapters | `IRevalidationClient` | `Env` |
| `SnapshotAssetReferenceProvider` | Adapter | `IAssetReferenceProvider` (owned by `assets`) | `ISnapshotRepository` |

```typescript
interface IDraftContributor<K extends DraftPartKey> {   // owned here; implemented by content modules
  readonly key: K;                                       // 'sections' | 'identity' | 'design'
  collect(scope: DraftScope): Promise<DraftParts[K]>;    // scope = { portfolioId, userId }:
}                                                        // the identity template needs the account
interface IPublishRule {
  readonly id: string;
  readonly severity: 'error' | 'warning';
  check(content: PublishedContent): Promise<PublishIssue[]>;
}
interface IPublishStep { run(ctx: PublishContext): Promise<PublishContext>; }
```
- **Work added inside other modules, each in that module's own folder:**
  `portfolio` — `SectionsDraftContributor` and `PublishedPointer` (implements
  `IPublishedPointerWriter` with compare-and-swap, and `IPublishedPointerReader`, which also
  resolves a slug to its pointer for `ISnapshotReader.getCurrentForSlug`); `identity` — `IdentityDraftContributor`; `design` — `DesignDraftContributor`. Each
  implements an interface this module owns (**Dependency Inversion**), and the container hands
  the list to `DraftAssembler`. `publishing` imports no other module's classes.
- Version allocation: unique index on `{ portfolioId, version }`, `max + 1` with a bounded retry
  on duplicate key.
- `IRevalidationClient` selection follows the dev-bypass guard: `NoopRevalidationClient` only when
  `NODE_ENV !== 'production'` and `WEB_REVALIDATE_URL` is unset; production without it fails
  startup.
- **Web:** `/cms/publish` — status, issues with deep links, publish confirmation, history.
- **Implementation notes (2026-10-21):** the pointer class is `PublishedPointerStore`
  (`portfolio/published-pointer.store.ts`) because `PublishedPointer` is the pointer's value type;
  `design` implements `IPublishDesignCheck` as `DesignPublishCheck`; the builder reads asset
  metadata through `IPublishedAssetSource` (the asset repository's `findById`, adapted in the
  container); rules walk the content with `content-walker.ts`, so no rule lists fields.
## Data Model
**`snapshots`** — `_id`, `portfolioId`, `version`, `contentHash`, `content` (PublishedContent),
`note`, `publishedAt`, `publishedBy`, `delivery: { status, at, attempts }`. Indexes: unique
`{ portfolioId, version }`; `{ portfolioId, publishedAt: -1 }`; `{ "content.assets.id": 1 }`.
**`portfolios`** (written by `portfolio` through `IPublishedPointerWriter`) gains
`publishedSnapshotId`, `publishedVersion`, `publishedAt`.
No seed data — a fresh install is unpublished.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] One writer per collection — `portfolios` still written only by `portfolio`
- [x] Open/Closed for rules, steps and contributors (AC17)
- [x] Draft isolation — `ISnapshotReader` is the only interface exported to `public-site`
- [x] Dev-bypass guard on the revalidation client, tested in both directions
- [x] Test-first for every endpoint and every rule
- [ ] Snapshot + pointer-swap model — pending acceptance of ADR-0004
## Explicitly Deferred
- Restore-to-draft from a snapshot — open at BRD stage.
- A durable outbox for the published event — an in-process bus plus the manual retry (API06) and
  the site's time-based fallback are sufficient at this scale.
## Sequencing
1. Contracts, snapshot model and append-only repository
2. Contributors and pointer writer in the content modules
3. Snapshot builder and canonical hashing
4. Rules and registry
5. Pipeline, steps, service
6. History and rollback
7. Event, revalidation listener and client
8. Controller, routes, container, OpenAPI, asset reference provider
9. CMS publish screen
