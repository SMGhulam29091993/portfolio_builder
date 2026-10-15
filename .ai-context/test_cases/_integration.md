# Cross-feature and system-level test scenarios

Scenarios that span more than one spec. Single-feature cases live in
`<slug>.test_cases.md`. IDs here are `INT<NN>`.

| Test ID | Specs involved | Scenario | Expected |
|---|---|---|---|
| INT01 | owner-auth · section-engine · work-showcase · publish-pipeline · public-site-rendering | **First-run journey.** Seed everything → sign in → try to publish → fix the Second Brain description → publish → open `/` | The first publish is blocked by `no-placeholder-text` only; after the fix the site shows all six sections |
| INT02 | publish-pipeline · public-site-rendering · every content module | **Draft isolation sweep.** After a publish, edit one field in every section, in identity and in design, and upload a new asset | `GET /api/v1/public/portfolio` and `/` are byte-identical to before; the new asset's public URL is 404 |
| INT03 | section-engine · cms-panel-shell · design-theme · publish-pipeline · public-site-rendering | **Open/Closed drill.** In a test build, add a throwaway section type through the four registrations only | It can be edited, previewed, published and rendered; the diff touches no file of the engine, the editor host, the page composer or the pipeline |
| INT04 | ai-design-studio · design-theme · publish-pipeline · public-site-rendering | **Design round trip.** Generate (stub) → preview → apply → publish → then activate the previous version | Site theme changes on publish and returns on rollback; the draft design keeps the applied proposal |
| INT05 | media-assets · site-identity · publish-pipeline · public-site-rendering | **Résumé lifecycle.** Upload → select in identity → publish → open the résumé from the nav → clear it in identity → publish → request the old URL → try to delete the asset | Download works while published; old URL is 404 after; delete is refused because an older snapshot still references the file |
| INT06 | owner-auth · cms-panel-shell · section-engine | **Session expiry mid-edit.** Expire the access cookie while a form has unsaved edits, then save | A silent refresh happens and the save succeeds with the edits intact |
| INT07 | cms-panel-shell · section-engine · site-identity · design-theme | **Concurrent editing.** Two sessions edit the same section, identity and design | Each second save shows the conflict dialog; nothing is overwritten without an explicit choice |
| INT08 | monorepo-foundation · all API modules | **Architecture conformance.** Compare the import graph with `architecture.md` → Module dependency map; check each collection has one writing module; check no class is instantiated outside `container.ts` | No undeclared edge, no second writer, no stray instantiation |
| INT09 | all seeders | **Seed idempotency.** Run `seed:all` on an empty database, again, and again after editing every document | Same document counts each time; every edit preserved |
| INT10 | ai-design-studio · publish-pipeline · monorepo-foundation | **Restart resilience.** Restart the API with a pending proposal, and immediately after a publish whose revalidation had not finished | Proposal becomes `INTERRUPTED`; the publish stands; the site converges through the time-based fallback |
| INT11 | publish-pipeline · public-site-rendering · the six section specs | **Full-page regression.** Edit → publish → screenshot at 1440 and 390 with the reference content | Matches the approved full-page baselines |
| INT12 | owner-auth · every `/cms` route | **Authorisation sweep.** Call every documented `/api/v1/cms/**` operation with no cookie, and every non-GET one with a foreign `Origin` | 401 for all; 403 for all non-GET |
| INT13 | every spec with an API | **Contract sweep.** For every operation in the OpenAPI document, assert success and error responses use the envelope and a canonical or spec-declared code | No ad-hoc response shape |
