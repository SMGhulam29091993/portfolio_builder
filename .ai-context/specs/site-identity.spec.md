# Spec: Site Identity
## Spec ID
site-identity
## Status
Draft
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Hold the facts about the owner that more than one part of the page uses — name, monogram,
role, email, location, availability, social links, the résumé file, footer credits and SEO text
— in one editable record, so the nav, hero, contact card, footer and page metadata all read the
same values and none of them is typed twice.
## Context
- Builds on: .ai-context/architecture.md (API modules → `identity`)
- Related: .ai-context/specs/media-assets.spec.md, hero-section.spec.md, contact-section.spec.md,
  public-site-rendering.spec.md
- Shared facts used: .ai-context/ownership_index.md (Shared payload primitives · Optimistic
  concurrency · Session contract · Asset reference); reference values:
  .ai-context/design_reference.md (Nav, Hero, Contact, Footer)
## API Contract
### site-identity.API01 — GET /api/v1/cms/identity
**Success response (200):** `data: { "identity": { "revision": 1, "updatedAt": "ISO-8601", "data": Identity } }`
**Exceptions:** 401 `UNAUTHENTICATED`.
### site-identity.API02 — PUT /api/v1/cms/identity
**Request payload:** `{ "expectedRevision": 1, "data": Identity }`
**Identity** — canonical owner of this shape (`ownership_index.md`):
```json
{ "fullName": "PlainText(80)",
  "monogram": "1..3 characters, A–Z or 0–9",
  "roleTitle": "PlainText(80)",
  "email": "email, ≤ 254",
  "location": { "label": "PlainText(60)", "timezoneLabel": "PlainText(24), optional" },
  "availability": { "enabled": true, "label": "PlainText(48)" },
  "socials": [ { "id": "ItemId", "platform": "github | linkedin | x | website", "url": "https URL" } ],
  "resume": { "assetId": "string | null", "label": "PlainText(16)" },
  "footer": { "copyrightName": "PlainText(80)", "builtWith": ["Tag"] },
  "seo": { "title": "PlainText(70)", "description": "PlainText(160)", "ogImageAssetId": "string | null" } }
```
Limits: `socials` 0..6 with at most one entry per platform; `footer.builtWith` 0..6.
**There is no phone field**, by design.
**Success response (200):** `data: { "identity": { … } }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Schema failure; duplicate platform; a URL that is not `https:` | `VALIDATION_FAILED` |
| 400 | `resume.assetId` does not exist or is not kind `resume`; `seo.ogImageAssetId` does not exist or is not kind `image` | `VALIDATION_FAILED` at that path |
| 401 / 403 | No session / `Origin` not allowed | `UNAUTHENTICATED` / `ORIGIN_NOT_ALLOWED` |
| 409 | Stale `expectedRevision` | `REVISION_CONFLICT`, `currentRevision` |
## Acceptance Criteria
1. site-identity.AC1 — Given a seeded database, when API01 is called, then it returns the
   reference identity: full name `S M Ghulam Ghaus Faiyaz`, monogram `GF`, the email shown in
   the contact card, location `Kolkata, India` with `IST (UTC+5:30)`, availability
   `Open to Full Stack & Gen AI roles`, résumé label `Résumé`, and footer credits
   `Next.js`, `Tailwind`, `Motion`.
2. site-identity.AC2 — Given revision *n*, when API02 is called with `expectedRevision: n` and a
   valid payload, then it is stored and the revision becomes *n + 1*.
3. site-identity.AC3 — Given a stale `expectedRevision`, when API02 is called, then the response
   is 409 with `currentRevision` and nothing is written.
4. site-identity.AC4 — Given a payload with an invalid email, a lower-case or 4-character
   monogram, an `http:` social URL, or two socials for the same platform, when API02 is called,
   then the response is 400 naming each failing path.
5. site-identity.AC5 — Given `resume.assetId` set to an id that does not exist, or to an asset
   whose kind is `image`, when API02 is called, then the response is 400 at `resume.assetId`.
6. site-identity.AC6 — Given `resume.assetId: null`, when API02 is called, then it is accepted.
7. site-identity.AC7 — Given a payload containing a `phone` key or any other unknown key, when
   API02 is called, then the request succeeds and the unknown key is neither stored nor
   returned.
8. site-identity.AC8 — Given an asset referenced by the draft identity, when the `assets` module
   asks its reference providers about that asset, then identity reports it as in use.
9. site-identity.AC9 — Given an empty database, when the identity seeder runs, then one identity
   exists with the reference values; running it again, or after an edit, changes nothing.
10. site-identity.AC10 — Given `/cms/identity`, when the owner edits and saves, then the form
    validates with the same schema, the résumé field offers only uploaded assets of kind
    `resume` (and "None"), and saving follows the shell's save, 400 and 409 behaviour.
## Edge Cases Covered
- Email is stored lower-cased; display uses the stored value.
- Emptying `socials` is valid; the hero and contact then render no social links.
- `availability.enabled: false` keeps the label but hides the badge.
- Deleting the résumé asset while referenced is blocked by `media-assets`, not handled here.
- The copyright year is derived at render time; it is not stored.
## Error Handling
- Asset existence is checked through `IAssetLookup`; a lookup failure is a 500, never treated
  as "asset missing".
- All validation failures are reported together in one 400, not one at a time.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| site-identity.UT01 | AC2 | `update` with matching revision (fake repo, fake asset lookup) | Saved; revision + 1 |
| site-identity.UT02 | AC3 | Repo reports no match | Throws `REVISION_CONFLICT` |
| site-identity.UT03 | AC4 | Schema: bad email, `gf`, `GFXY`, `http://` URL, duplicate platform | Five distinct path errors |
| site-identity.UT04 | AC5 | Lookup returns nothing / returns kind `image` for the résumé | Validation error at `resume.assetId` |
| site-identity.UT05 | AC6 | `resume.assetId: null` | Lookup not called; saved |
| site-identity.UT06 | AC7 | Payload with `phone` | Parsed value has no `phone` |
| site-identity.UT07 | AC8 | `referencesAsset(id)` for the résumé id, the OG image id, another id | true, true, false |
## Open Questions
1. **OQ1 — Link targets.** The export encodes no URLs. The seed uses
   `https://github.com/SMGhulam29091993` and `https://linkedin.com/in/s-m-ghulam-ghaus-faiyaz`
   from the résumé PDF. Confirm both.
2. **OQ2 — SEO text.** The design shows no page title or description. The seed composes the title
   from `fullName` and `roleTitle` and reuses the hero intro as the description. Confirm or
   supply.
## Explicitly Out of Scope
- Uploading files — `media-assets`.
- Rendering the nav, footer and metadata — `public-site-rendering`.
- A phone number, postal address, or any other personal field not in the reference design.
- Multiple locales.
## Non-Functional Constraints (from constitution.md)
- Email is PII: never logged.
- URLs are `https:` only, validated on write and again at publish.
- `identity` is the only writer of `identities`.
