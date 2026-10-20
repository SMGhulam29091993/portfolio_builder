# Spec: Design Theme
## Spec ID
design-theme
## Status
Implemented
- `In Progress → Implemented` on 2026-10-20: T01–T04, T06, T07 completed (T05 dropped, see
  below), each with a DoD self-check line in `state/completed.md`.
- `Ready → In Progress` on 2026-10-20 with `design-theme.T01` started.
- DoR self-check: 2026-10-20, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`). ADR-0006 accepted (with the variant
  amendment); OQ1 and OQ2 resolved by the owner.
- Revised 2026-10-20, before the spec was ever `Ready`: (1) ADR-0006's amendment — two variants
  per section, the reference layout first; (2) ADR-0010 — one design per portfolio; with none
  stored, API01 answers `DEFAULT_DESIGN` (the reference design: the owner's "design only"
  template) at `revision: 0`, and the first API02 (`expectedRevision: 0`) creates it, so no
  seeder is needed (T05 dropped; AC1 is met by the revision-0 default); (3) the font
  allow-list and default colours from the owner's answers (below).
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
**Variant catalogue (version 1 — two variants per section; the first is the reference layout and
the fallback for an unknown id; ADR-0006 → Variant catalogue):**
| Section | Variant id | Layout |
|---|---|---|
| `hero` | `split-code-card` | Reference: text left, code card right, marquee below |
| `hero` | `centered` | Centred text and buttons, code card below, marquee below |
| `about` | `bento` | Reference: bio + currently, 2 × 2 stats, process card |
| `about` | `stacked` | Bio, currently, stats in one row, process steps as a list |
| `work` | `featured-grid` | Reference: one full-width featured card, then a three-column grid |
| `work` | `list` | Every project as a full-width row, featured first |
| `experience` | `timeline` | Reference: dates left of a vertical line, details right |
| `experience` | `cards` | One card per role in a two-column grid |
| `stack` | `chip-groups` | Reference: three-column chip groups, then education and certifications |
| `stack` | `columns` | Chip groups as one column of labelled rows |
| `contact` | `glow-card` | Reference: one centred card with a rising glow |
| `contact` | `minimal` | Left-aligned heading and links, no card |
**Font allow-list (owner, 2026-10-20):** each `FontId` belongs to exactly one role and maps to a
`next/font/google` loader; the first in each role is the reference default.
| Role | Fonts |
|---|---|
| `sans` | `inter` (Inter), `manrope` (Manrope), `space-grotesk` (Space Grotesk) |
| `display` | `instrument-serif` (Instrument Serif, italic), `playfair-display` (Playfair Display, italic), `fraunces` (Fraunces, italic) |
| `mono` | `jetbrains-mono` (JetBrains Mono), `ibm-plex-mono` (IBM Plex Mono), `fira-code` (Fira Code) |
**Default colours (owner, 2026-10-20 — the samples accepted; unsampled tokens the nearest
neutral that passes the contrast rule):** background `#09090b`, surface `#111113`, surfaceRaised
`#151517`, border `#27272a`, text `#ededef`, textMuted `#a1a1aa`, accent `#c0f83c`, onAccent
`#09090b`. Radius `xl`; glow, dot grid on; motion `subtle`.
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
1. ~~**OQ1 — Fonts.**~~ Resolved 2026-10-20 (owner): Inter, Instrument Serif, JetBrains Mono.
2. ~~**OQ2 — Exact colours.**~~ Resolved 2026-10-20 (owner): accent `#c0f83c`; samples accepted.
## Explicitly Out of Scope
- Generating designs — `ai-design-studio`.
- Variants beyond the twelve above — each new variant is its own change to this catalogue.
- The renderers themselves — each section spec builds both of its variants.
- Per-section colour overrides; light/dark mode switching; custom CSS.
- Arbitrary font URLs or uploads.
## Non-Functional Constraints (from constitution.md)
- WCAG 2.1 AA contrast enforced in code.
- No font URL is ever taken from stored data.
- `design` is the only writer of `designs`.
