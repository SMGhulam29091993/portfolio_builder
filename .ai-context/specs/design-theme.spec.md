# Spec: Design Theme
## Spec ID
design-theme
## Status
Draft
## Linked BRD
.ai-context/BRD.md#BRD-003
## Intent
Express the portfolio's look as data — a set of theme tokens and one layout variant per
section — so the reference design is the seeded default rather than hardcoded styling, the
owner can adjust it from the CMS, and an AI proposal can replace it safely. The server refuses
any design that is malformed, names something outside the catalogue, or fails a contrast floor,
so every stored design is renderable and readable.
## Context
- Builds on: .ai-context/architecture.md (API modules → `design`, Shared packages)
- Related: .ai-context/decisions/ADR-0006-ai-output-is-constrained-data.md;
  .ai-context/specs/ai-design-studio.spec.md, public-site-rendering.spec.md
- Shared facts used: .ai-context/ownership_index.md (Optimistic concurrency · Session contract ·
  Section type catalogue); sampled values: .ai-context/design_reference.md (Visual tokens)
## Design payload
Canonical owner of `DesignSpec` (`ownership_index.md`). Defined in `packages/design-tokens`.
```json
{ "theme": {
    "colors": { "background": "#rrggbb", "surface": "#rrggbb", "surfaceRaised": "#rrggbb",
                "border": "#rrggbb", "text": "#rrggbb", "textMuted": "#rrggbb",
                "accent": "#rrggbb", "onAccent": "#rrggbb" },
    "fonts": { "sans": "FontId", "display": "FontId", "mono": "FontId" },
    "radius": "none | sm | md | lg | xl",
    "effects": { "glow": true, "dotGrid": true, "motion": "none | subtle | full" } },
  "layout": { "hero": "VariantId", "about": "VariantId", "work": "VariantId",
              "experience": "VariantId", "stack": "VariantId", "contact": "VariantId" } }
```
**Variant catalogue (version 1 — one variant per section, each the reference layout):**
| Section | Variant id | Reference layout |
|---|---|---|
| `hero` | `split-code-card` | Text left, code card right, marquee below |
| `about` | `bento` | Bio + currently, 2 × 2 stats, process card |
| `work` | `featured-grid` | One full-width featured card, then a three-column grid |
| `experience` | `timeline` | Dates left of a vertical line, details right |
| `stack` | `chip-groups` | Three-column chip groups, then education and certifications |
| `contact` | `glow-card` | One centred card with a rising glow |
**Font allow-list:** each `FontId` belongs to exactly one role (`sans`, `display`, `mono`) and
maps to a bundled `next/font` loader. Its contents are blocked on OQ1.
**Contrast rule** (WCAG relative-luminance ratio, computed by code):
| Pair | Minimum |
|---|---|
| `text` on `background`, `surface`, `surfaceRaised` | 4.5 : 1 |
| `textMuted` on `background`, `surface` | 4.5 : 1 |
| `onAccent` on `accent` | 4.5 : 1 |
| `accent` on `background` | 3 : 1 |
## API Contract
### design-theme.API01 — GET /api/v1/cms/design
**Success response (200):**
```json
{ "data": { "design": { "revision": 1, "updatedAt": "ISO-8601", "theme": { }, "layout": { } },
            "catalogue": { "variants": { "hero": [ { "id": "split-code-card", "label": "Split with code card" } ] },
                           "fonts": [ { "id": "string", "label": "string", "role": "sans" } ] } } }
```
**Exceptions:** 401 `UNAUTHENTICATED` / `SESSION_EXPIRED` (the guard — `owner-auth` → Request authorization).
### design-theme.API02 — PUT /api/v1/cms/design
**Request payload:** `{ "expectedRevision": 1, "theme": { }, "layout": { } }`
**Success response (200):** `data: { "design": { … } }`
**Exceptions:**
| Code | Condition | Response body |
|---|---|---|
| 400 | Malformed hex; unknown `FontId`; a font used in the wrong role; unknown `VariantId` or one belonging to another section; a missing section key | `VALIDATION_FAILED` |
| 400 | A contrast pair below its minimum | `VALIDATION_FAILED`; path names the foreground token; message carries the measured ratio and the minimum |
| 401 / 403 | No session / `Origin` not allowed | — |
| 409 | Stale `expectedRevision` | `REVISION_CONFLICT`, `currentRevision` |
### design-theme.API03 — POST /api/v1/cms/design/reset
**Request payload:** `{ "expectedRevision": 4 }`
**Success response (200):** the design replaced by the default theme and layout; revision + 1.
**Exceptions:** 401 / 403; 409 `REVISION_CONFLICT`.
## Acceptance Criteria
1. design-theme.AC1 — Given a seeded database, when API01 is called, then it returns the default
   design — the reference theme and the six reference variants — together with the catalogue.
2. design-theme.AC2 — Given a valid design and matching revision, when API02 is called, then it
   is stored and the revision increments.
3. design-theme.AC3 — Given a colour that is not a 6-digit hex, a `FontId` outside the
   allow-list, a `mono` font placed in `sans`, or a `VariantId` not in that section's catalogue,
   when API02 is called, then the response is 400 naming each path and nothing is stored.
4. design-theme.AC4 — Given `text` and `background` whose contrast ratio is below 4.5 : 1, when
   API02 is called, then the response is 400 whose message states the measured ratio and the
   required minimum; the same holds for every pair in the contrast rule.
5. design-theme.AC5 — Given a stale `expectedRevision`, when API02 or API03 is called, then the
   response is 409 and nothing changes.
6. design-theme.AC6 — Given an edited design, when API03 is called, then the stored design
   equals the default exported by `packages/design-tokens`.
7. design-theme.AC7 — Given any valid theme, when `toCssVariables(theme)` runs, then it emits
   one CSS custom property per token, and the same theme always produces byte-identical output.
8. design-theme.AC8 — Given the default theme, when the reference page is rendered, then no
   component contains a colour, radius or font literal — every such value resolves from a CSS
   variable (verified by a lint rule over `packages/sections`).
9. design-theme.AC9 — Given `effects.motion: "none"`, when the page renders, then no animation
   runs; given the visitor prefers reduced motion, then none runs regardless of the setting.
10. design-theme.AC10 — Given `/cms/design`, when a colour is changed, then the preview updates
    live, each contrast pair shows its ratio with pass or fail, Save is disabled while any pair
    fails, and the variant and font controls offer only catalogue entries.
11. design-theme.AC11 — Given another module holding only `IDesignValidator`, when it validates
    a candidate design, then the outcome is identical to what API02 would return for the same
    input.
## Edge Cases Covered
- Upper-case hex input is normalised to lower case; 3-digit and 8-digit hex are rejected.
- A section type added later with no entry in `layout`: the renderer falls back to that
  section's first catalogue variant, and the next save must include the key.
- A variant removed from the catalogue while stored designs or snapshots still name it:
  renderers keep resolving it — a variant id is never deleted, only hidden from the catalogue.
- Identical foreground and background (ratio 1 : 1) → 400.
## Error Handling
- All validation problems are returned in one response.
- Contrast is computed server-side from the stored values; client-side results are advisory.
- A default theme that fails its own validator fails container startup.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| design-theme.UT01 | AC4 | `contrastRatio('#ffffff', '#000000')` and `('#777777', '#ffffff')` | 21.0; about 4.48 |
| design-theme.UT02 | AC4 | Validator with each contrast pair set just below its minimum, one at a time | One error per case, at the right path, with the ratio |
| design-theme.UT03 | AC3 | Validator with bad hex, unknown font, wrong-role font, foreign variant | Four path errors |
| design-theme.UT04 | AC2, AC5 | `DesignService.update` with matching / stale revision (fake repo) | Saved / `REVISION_CONFLICT` |
| design-theme.UT05 | AC6 | `reset` | Repo receives the package default |
| design-theme.UT06 | AC7 | `toCssVariables` twice on the same theme | Identical strings; every token present |
| design-theme.UT07 | Edge | Hex `#ABCDEF`, `#abc`, `#aabbccdd` | Normalised; rejected; rejected |
| design-theme.UT08 | AC1 | Default design through the validator | Valid |
## Open Questions
1. **OQ1 — Fonts.** The three font families of the reference design cannot be read from the
   export. Name them (or approve substitutes) so the allow-list and the default theme can be
   defined. Until then `fonts` has no seedable values.
2. **OQ2 — Exact colours.** Background `#09090b` is reliable. Accent (≈ `#c0f83c`), border and
   muted-text values are sampled from a JPEG and approximate. Supply exact values or accept the
   samples.
## Explicitly Out of Scope
- Generating designs — `ai-design-studio`.
- Additional layout variants beyond the six reference ones — each new variant is its own spec.
- Per-section colour overrides; light/dark mode switching; custom CSS.
- Arbitrary font URLs or uploads.
## Non-Functional Constraints (from constitution.md)
- WCAG 2.1 AA contrast enforced in code.
- No font URL is ever taken from stored data.
- `design` is the only writer of `designs`.
