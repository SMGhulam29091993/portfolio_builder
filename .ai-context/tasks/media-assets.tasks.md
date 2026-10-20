# Tasks: Media Assets
## Derived From
.ai-context/plans/media-assets.plan.md
## Sequence
- [x] media-assets.T01 — `packages/contracts/src/assets` (`AssetReference`, kinds, limits); `assets` model with indexes; `AssetRepository` — Acceptance: AC6, AC7
- [x] media-assets.T02 — `IFileStorage`, `GridFsFileStorage`, `InMemoryFileStorage`, and the shared storage contract suite (no `FileStorageFactory`: one backend, the container picks it — a factory would be ceremony; `constitution.md` → patterns only where the seam is real) — Acceptance: AC12
- [x] media-assets.T03 — Upload validation: `MagicByteContentTypeDetector`, `SizeLimitStream`, `sanitizeFilename`, zero-byte rejection — Acceptance: AC2, AC3, AC4, AC5
- [x] media-assets.T04 — `AssetService`: upload with dedupe and cleanup on failure, list with `inUse`, delete gated by `IAssetReferenceProvider[]`, lookup and reader interfaces — Acceptance: AC1, AC6, AC7, AC8, AC9
- [x] media-assets.T05 — `AssetController` (streaming multipart on the upload route only), routes, container wiring with an empty provider list, OpenAPI for API01–API04 — Acceptance: AC1, AC10
- [x] media-assets.T06 — `/cms/assets` screen: upload with progress, error explanations, list, guarded delete — Acceptance: AC11
