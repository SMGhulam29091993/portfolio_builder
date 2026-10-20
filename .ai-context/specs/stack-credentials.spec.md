# Spec: Stack and Credentials
## Spec ID
stack-credentials
## Status
Implemented
- `In Progress → Implemented` on 2026-10-21: the last task, the layout check at 1440 and 390 with
  axe, ran in `public-site-rendering`'s journeys, where the page renders at real widths.
- DoR self-check: 2026-10-20, pass. Moved `Draft → Ready` by the agent under the owner's
  standing authorisation of 2026-10-20 (`governance.md`), then `Ready → In Progress`.
- Revised 2026-10-20, before the spec was ever `Ready`: (1) ADR-0010 — the definition's
  `defaults()` is the reference template (this layout with bracketed placeholder text,
  e.g. `[Your headline]`) for every new portfolio; the reference content below is seed data for
  the development account only (`seed:all`); (2) ADR-0006 amendment — this spec builds both
  catalogue variants of `stack`: `chip-groups` (the reference layout, the fallback) and `columns`
  (`design-theme` → Variant catalogue), with the same payload; (3) renderers receive the
  identity through the page context (`packages/sections` `SectionContext`); (4) visual
  baselines are replaced by layout assertions in Playwright (element positions at 1440 and 390)
  plus axe: pixel baselines differ between macOS and CI's Linux and would need per-platform
  snapshots nobody has reviewed.
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Make the "04 Stack" block editable content of section type `stack`: named groups of skill
chips, an education and training list, and a certifications list — the three things the
reference design presents together under one heading.
## Context
- Builds on: .ai-context/architecture.md (Section type catalogue)
- Related: .ai-context/specs/section-engine.spec.md
- Shared facts used: .ai-context/ownership_index.md (Section engine endpoints · Shared payload
  primitives); reference content: .ai-context/design_reference.md (04 Stack)
## API Contract
No endpoints of its own. This spec owns the `data` payload of `section-engine.API03` for
`:type = stack`.
```json
{ "meta": "SectionMeta",
  "heading": "EmphasisHeading",
  "groups": [ { "id": "ItemId", "label": "PlainText(30)", "items": ["PlainText(30)"] } ],
  "education": { "enabled": true, "label": "PlainText(32)",
                 "entries": [ { "id": "ItemId", "title": "PlainText(80)",
                                "institution": "PlainText(100)", "startYear": 2019,
                                "endYear": "number | null", "detail": "PlainText(60), optional" } ] },
  "certifications": { "enabled": true, "label": "PlainText(32)",
                      "entries": [ { "id": "ItemId", "name": "PlainText(80)",
                                     "issuer": "PlainText(60)", "url": "https URL | null" } ] } }
```
Limits: `groups` 1..9, each with 1..16 unique items; `education.entries` 0..8;
`certifications.entries` 0..12; years 1950..(current year + 6); `endYear` not before `startYear`.
**Definition flags:** orderable, hideable, in nav.
## Acceptance Criteria
1. stack-credentials.AC1 — Given a seeded database, when the stack section is read, then it
   holds the six reference groups with their items in order, the three education entries (PGPM,
   B.Tech, Full Stack Web Development) and the two certifications (Claude 101, Claude Code 101 —
   Anthropic), with the text in the design reference.
2. stack-credentials.AC2 — Given a payload with no groups, a group with no items or 17 items,
   duplicate items within a group, an `endYear` before its `startYear`, or an `http:`
   certification URL, when it is saved, then the response is 400 naming each path.
3. stack-credentials.AC3 — Given the page at 1440, when the groups render, then they form a
   three-column grid of cards, each with a mono upper-case label and its items as chips that
   wrap; given 390, then the cards stack in one column in list order.
4. stack-credentials.AC4 — Given both lists enabled, when the section renders at 1440, then the
   education card takes about two thirds of the row and the certifications card one third,
   beneath the groups; at 390 education comes first, then certifications.
5. stack-credentials.AC5 — Given an education entry, when it renders, then the title and
   institution are on the left and the years (`2019 – 2021`) with the `detail` beneath them are
   on the right in the mono font, with a divider between entries; an entry with
   `endYear: null` shows `<startYear> – Present`.
6. stack-credentials.AC6 — Given a certification, when it renders, then it is a nested card
   with name and issuer; given it has a `url`, then the card is a link opening in a new tab with
   an accessible name stating the certification and issuer.
7. stack-credentials.AC7 — Given one list is disabled or empty, when the section renders, then
   its card is absent and the other spans the full width; given both are, then neither card nor
   an empty row is rendered.
8. stack-credentials.AC8 — Given the section, when it renders, then each group label, the
   education label and the certifications label are `h3` headings, and each group's chips are a
   list.
9. stack-credentials.AC9 — Given `/cms/sections/stack`, when the owner edits, then groups are a
   reorderable list of labelled tag inputs, education and certifications are list fields with a
   switch each, and the preview reflects edits.
## Edge Cases Covered
- Seven or eight groups leave an incomplete last row, left-aligned.
- A group with one item renders a single chip without stretching it.
- Education entries render in list order — the reference is not chronological (PGPM before
  B.Tech), so no automatic sorting is applied.
- A long institution name wraps under the title without pushing the years off the row at 1440;
  at 390 the years move beneath the institution.
## Error Handling
- Payload errors return through the engine in one 400.
- A disabled list keeps its entries in the draft.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| stack-credentials.UT01 | AC2 | Schema with each invalid case in AC2 | One error per case |
| stack-credentials.UT02 | AC1 | Definition defaults and seed file through the schema | Both valid |
| stack-credentials.UT03 | AC5 | Render entries with and without `endYear` and `detail` | `2019 – 2021`; `2023 – Present`; no empty detail line |
| stack-credentials.UT04 | AC6 | Render a certification with and without a URL | Link with a descriptive name / plain card |
| stack-credentials.UT05 | AC7 | Render with each list disabled, and both | Remaining card full width; no empty row |
| stack-credentials.UT06 | AC8 | Inspect markup | `h3` labels; chips in `ul` |
## Explicitly Out of Scope
- Skill proficiency levels, ratings or years per skill.
- Technology logos or icons per chip.
- Linking a chip to projects that used it.
- Certificate images or credential-ID verification.
## Non-Functional Constraints (from constitution.md)
- Links are `https:` only.
- No literal content in the renderer.
