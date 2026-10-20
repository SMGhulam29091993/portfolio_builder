# Tasks: Publish Pipeline
## Derived From
.ai-context/plans/publish-pipeline.plan.md
## Sequence
- [x] publish-pipeline.T01 — `packages/contracts/src/publishing` (`PublishedContent`, `PublishIssue`, request/response schemas); `snapshots` model with indexes; `SnapshotRepository` exposing insert / read / update-delivery only — Acceptance: AC14
- [x] publish-pipeline.T02 — `IDraftContributor`, `IPublishedPointerWriter`, `IPublishedPointerReader` interfaces; `SectionsDraftContributor` + `PublishedPointer` in `portfolio`, `IdentityDraftContributor` in `identity`, `DesignDraftContributor` in `design`; update the dependency map if any edge differs — Acceptance: AC9, AC11
- [x] publish-pipeline.T03 — `ICanonicalHasher` (sorted-key JSON + SHA-256), `SnapshotBuilder`, `DraftAssembler` — Acceptance: AC9, AC10
- [ ] publish-pipeline.T04 — `IPublishRule`, `PublishRuleRegistry`, and the nine rules in the rules table, each with a passing and a failing fixture — Acceptance: AC4, AC5, AC6, AC17
- [ ] publish-pipeline.T05 — `PublishPipeline` with `ValidateStep`, `PersistSnapshotStep`, `ActivateStep`, `EmitPublishedStep`; `PublishingService` status / validate / publish with version allocation and conflict handling — Acceptance: AC1, AC2, AC3, AC7, AC8, AC15, AC16
- [ ] publish-pipeline.T06 — Snapshot history listing with cursor pagination; activate (rollback) through the same pointer writer — Acceptance: AC13
- [ ] publish-pipeline.T07 — `portfolio.published` event, `SiteRevalidationListener`, `HttpRevalidationClient` / `NoopRevalidationClient` with the dev-bypass guard and production startup check, manual retry — Acceptance: AC12
- [ ] publish-pipeline.T08 — `PublishingController`, routes, container wiring (contributors, rules, steps), OpenAPI for API01–API06; `SnapshotAssetReferenceProvider` registered with `assets` — Acceptance: AC2, AC18
- [ ] publish-pipeline.T09 — `/cms/publish` screen: status, grouped issues with links, confirm + note, history with "Make live" — Acceptance: AC19
