# Spec: Experience Timeline
## Spec ID
experience-timeline
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
  catalogue variants of `experience`: `timeline` (the reference layout, the fallback) and `cards`
  (`design-theme` → Variant catalogue), with the same payload; (3) renderers receive the
  identity through the page context (`packages/sections` `SectionContext`); (4) visual
  baselines are replaced by layout assertions in Playwright (element positions at 1440 and 390)
  plus axe: pixel baselines differ between macOS and CI's Linux and would need per-platform
  snapshots nobody has reviewed.
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Make the "03 Experience" block editable content of section type `experience`: a list of roles,
each with company, title, location, start and end month and highlight bullets, rendered as a
vertical timeline that orders itself by date and marks the current role.
## Context
- Builds on: .ai-context/architecture.md (Section type catalogue)
- Related: .ai-context/specs/section-engine.spec.md
- Shared facts used: .ai-context/ownership_index.md (Section engine endpoints · Shared payload
  primitives); reference content: .ai-context/design_reference.md (03 Experience)
## API Contract
No endpoints of its own. This spec owns the `data` payload of `section-engine.API03` for
`:type = experience`.
```json
{ "meta": "SectionMeta",
  "heading": "EmphasisHeading",
  "presentLabel": "PlainText(16)",
  "entries": [ { "id": "ItemId", "company": "PlainText(80)", "role": "PlainText(80)",
                 "location": "PlainText(60), optional",
                 "start": { "year": 2024, "month": 9 },
                 "end": "{ year, month } | null",
                 "highlights": ["PlainText(220)"] } ] }
```
Limits: `entries` 1..12; `highlights` 1..6 per entry; `year` 1970..(current year + 1); `month`
1..12; `end` is not before `start`; `end: null` means the role is current.
**Definition flags:** orderable, hideable, in nav.
## Acceptance Criteria
1. experience-timeline.AC1 — Given a seeded database, when the experience section is read, then
   it holds the two reference roles — Indus Net Technologies (Associate Software Engineer,
   Kolkata, September 2024 to present, four highlights) and DCG Data Core System (Project
   Associate, Kolkata, January 2024 to September 2024, two highlights) — with the text in the
   design reference.
2. experience-timeline.AC2 — Given a payload with an `end` earlier than its `start`, month 13,
   an entry with no highlights or seven highlights, or a thirteenth entry, when it is saved,
   then the response is 400 naming each path.
3. experience-timeline.AC3 — Given entries saved in any order, when the section renders, then
   current roles come first and all entries are ordered by `start` descending; ties keep their
   list order.
4. experience-timeline.AC4 — Given an entry, when its date range renders, then it reads
   `<Mon> <YYYY> — <Mon> <YYYY>` using the abbreviations Jan, Feb, Mar, Apr, May, Jun, Jul, Aug,
   Sept, Oct, Nov, Dec, with `presentLabel` in place of the end for a current role — so the
   reference entries read `Sept 2024 — Present` and `Jan 2024 — Sept 2024`.
5. experience-timeline.AC5 — Given the page at 1440, when the section renders, then each entry
   has its date range and location right-aligned in a left column, a marker on a continuous
   vertical line, and company, role and highlights to the right; given 390, then the marker and
   line sit at the left edge with the date range and location above the company name.
6. experience-timeline.AC6 — Given a current role, when its marker renders, then it is the
   accent colour with a glow (when the theme's `effects.glow` is on); past roles have a muted
   marker.
7. experience-timeline.AC7 — Given the section, when it renders, then the entries are an ordered
   list, each company is an `h3`, each date range is a `<time>`-annotated element with machine
   readable `YYYY-MM` values, and highlights are an unordered list with accent bullets.
8. experience-timeline.AC8 — Given `/cms/sections/experience`, when the owner edits, then each
   entry has month and year pickers, a "Current role" switch that clears and disables the end
   date, a highlights list field, and the preview shows the derived ordering.
## Edge Cases Covered
- Two current roles: both are marked current; ordered by start descending.
- A single entry: the line is drawn with one marker and no dangling tail.
- A role that started and ended in the same month renders the month once on each side.
- A missing `location` omits that line without leaving a blank row.
- A future `start` (up to next year) is accepted — an accepted offer can be listed.
## Error Handling
- Payload errors return through the engine in one 400.
- Date ordering is derived at render, so a stored list order can never produce a wrong timeline.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| experience-timeline.UT01 | AC2 | Schema with each invalid case in AC2 | One error per case |
| experience-timeline.UT02 | AC1 | Definition defaults and seed file through the schema | Both valid |
| experience-timeline.UT03 | AC3 | `sortEntries` with mixed current / past / tied entries | Current first; start descending; stable |
| experience-timeline.UT04 | AC4 | `formatRange` for the two reference entries and a same-month role | `Sept 2024 — Present`; `Jan 2024 — Sept 2024`; same month both sides |
| experience-timeline.UT05 | AC6 | Render a current and a past entry | Marker variants differ |
| experience-timeline.UT06 | AC7 | Inspect markup | `ol`, `h3`, `time[datetime="2024-09"]`, `ul` |
| experience-timeline.UT07 | AC8 | Editor: toggle "Current role" on an entry with an end date | `end` becomes null; picker disabled |
## Explicitly Out of Scope
- Company logos or links — none in the reference design.
- Sub-projects nested under a role as structured data (they are highlight text).
- Day-level dates; total-experience calculation.
## Non-Functional Constraints (from constitution.md)
- No literal content in the renderer.
- Month names are a fixed English list; localisation is not in scope.
