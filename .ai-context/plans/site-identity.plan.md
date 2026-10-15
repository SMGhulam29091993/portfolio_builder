# Plan: Site Identity
## Derived From
.ai-context/specs/site-identity.spec.md
## Architecture Approach
Module `apps/api/src/modules/identity/`, module file pattern.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `IdentityController` | Controller | — | `IIdentityService` |
| `IdentityService` | Service | `IIdentityService`, `IIdentityReader` | `IIdentityRepository`, `IAssetLookup` (from `assets`) |
| `IdentityRepository` | Repository | `IIdentityRepository` | Mongoose model |
| `IdentityAssetReferenceProvider` | Adapter | `IAssetReferenceProvider` (owned by `assets`) | `IIdentityRepository` |
| `IdentitySeeder` | Seed | `ISeeder` | `IIdentityRepository`, seed-data loader |
- `index.ts` exports `IIdentityReader` and the `Identity` type.
- The `IDraftContributor` implementation for identity is added by `publish-pipeline`.
- **Web:** `/cms/identity` — one form built from the shell's form kit; the résumé and OG-image
  selects read `media-assets.API02`.
- Module edge used: `identity → assets` (already in the dependency map).
## Data Model
**`identities`** — `_id`, `portfolioId` (unique index), `revision`, `data` (the Identity shape),
`updatedAt`.
**Seed:** `apps/api/src/seed/data/identity.json` from `design_reference.md` plus the two résumé
URLs (OQ1). `resume.assetId` is seeded `null`; the résumé PDF is uploaded through the CMS.
## Constitution Check
- [x] No new datastore introduced without ADR
- [x] One writer per collection
- [x] Interface owned by the consumer (`IAssetReferenceProvider` belongs to `assets`)
- [x] No PII logged; no phone field
- [x] Seed data, not literals
## Explicitly Deferred
- Custom social platforms beyond the four listed — add to the enum when needed.
- Favicon / monogram image upload — the monogram is text in the reference design.
- Structured data (JSON-LD) fields — rendering concern, see `public-site-rendering`.
## Sequencing
1. Contract schema
2. Model + repository
3. Service with asset validation
4. Controller, routes, container, OpenAPI
5. Asset reference provider
6. Seeder
7. CMS identity screen
