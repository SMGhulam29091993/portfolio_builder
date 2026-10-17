# Plan: Media Assets
## Derived From
.ai-context/specs/media-assets.spec.md
## Architecture Approach
Module `apps/api/src/modules/assets/`, module file pattern plus `storage/`.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `AssetController` | Controller | — | `IAssetService` |
| `AssetService` | Service | `IAssetService`, `IAssetLookup`, `IAssetReader` | `IAssetRepository`, `IFileStorage`, `IContentTypeDetector`, `IAssetReferenceProvider[]` |
| `AssetRepository` | Repository | `IAssetRepository` | Mongoose model |
| `GridFsFileStorage` | Adapter | `IFileStorage` | MongoDB connection |
| `InMemoryFileStorage` | Adapter (tests) | `IFileStorage` | — |
| `MagicByteContentTypeDetector` | Adapter | `IContentTypeDetector` | — |
| `SizeLimitStream` | Stream transform | — | — |

```typescript
interface IFileStorage {
  put(key: string, source: Readable): Promise<{ sizeBytes: number; sha256: string }>;
  get(key: string): Promise<Readable>;           // throws NotFoundError
  delete(key: string): Promise<void>;            // idempotent
}
interface IAssetReferenceProvider {               // owned here, implemented by consumers
  readonly label: string;                         // e.g. "draft identity", "published snapshots"
  referencesAsset(assetId: string, portfolioId: string): Promise<boolean>;
}
```
- `index.ts` exports `IAssetLookup` (exists + kind), `IAssetReader` (metadata + stream),
  `IAssetReferenceProvider`, and the `AssetReference` type.
- The container passes the provider list into `AssetService`; `identity` and `publishing` each
  register one. `assets` imports neither module (**Dependency Inversion**).
- Upload pipeline: multipart stream → first-chunk detection → `SizeLimitStream` → hashing
  pass-through → `IFileStorage.put`. Nothing is buffered whole in memory.
- Patterns: **Adapter + Factory** for storage (`FileStorageFactory`, one backend today).
- **Web:** `/cms/assets` — upload control with progress, list, delete with in-use reason.
## Data Model
**`assets`** — `_id`, `portfolioId`, `kind`, `filename`, `mime`, `sizeBytes`, `sha256`,
`storageKey`, `createdAt`. Indexes: `{ portfolioId, kind, createdAt: -1 }`; unique
`{ portfolioId, sha256, kind }`.
**GridFS bucket `asset_files`** — `asset_files.files`, `asset_files.chunks`, written only through
`GridFsFileStorage`.
No seed data: the résumé is uploaded by the owner.
## Constitution Check
- [x] Upload rules: sniffed type, capped size, SVG rejected
- [x] One writer per collection, including the GridFS bucket
- [x] Draft isolation: no anonymous route in this module
- [x] Interfaces owned by the consumer; storage substitutable (AC12 contract suite)
- [x] No new datastore introduced without ADR — GridFS is MongoDB (ADR-0007, accepted 2026-10-15)
## Explicitly Deferred
- Object storage adapter — new `IFileStorage` implementation plus an ADR.
- Image variants / responsive sizes — only one optional OG image exists today.
- Garbage collection of unreferenced snapshot-only assets — no pruning policy for snapshots.
## Sequencing
1. Contracts, model, repository
2. `IFileStorage` + GridFS and in-memory adapters + contract suite
3. Content-type detection, size limiting, filename sanitising
4. `AssetService`
5. Controller, routes, container, OpenAPI
6. CMS assets screen
