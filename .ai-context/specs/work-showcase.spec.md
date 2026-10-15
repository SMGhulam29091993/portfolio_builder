# Spec: Work Showcase
## Spec ID
work-showcase
## Status
Draft
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Make the "02 Selected work" block editable content of section type `work`: a list of projects,
one of which can be featured and rendered as the large card with a metric grid, the rest as
compact cards with category, description, up to two metrics, tags and an optional outbound link.
## Context
- Builds on: .ai-context/architecture.md (Section type catalogue)
- Related: .ai-context/specs/section-engine.spec.md, publish-pipeline.spec.md (placeholder rule)
- Shared facts used: .ai-context/ownership_index.md (Section engine endpoints · Shared payload
  primitives); reference content: .ai-context/design_reference.md (02 Selected work)
## API Contract
No endpoints of its own. This spec owns the `data` payload of `section-engine.API03` for
`:type = work`.
```json
{ "meta": "SectionMeta",
  "heading": "EmphasisHeading",
  "featuredBadge": "PlainText(16)",
  "projects": [ { "id": "ItemId", "title": "PlainText(60)", "category": "PlainText(80)",
                  "description": "PlainText(400)", "featured": false,
                  "metrics": ["Metric"], "tags": ["Tag"], "link": "https URL | null" } ] }
```
Limits: `projects` 1..9; at most one project with `featured: true`; `metrics` 0..4 on the
featured project and 0..2 on the others; `tags` 0..10, unique within a project.
**Definition flags:** orderable, hideable, in nav.
## Acceptance Criteria
1. work-showcase.AC1 — Given a seeded database, when the work section is read, then it holds
   the four reference projects in order — Medeeze / VMD (featured, four metrics, seven tags),
   Sovihealth, OutThereMedia, Second Brain (link `https://app.second-brain.live`) — with the
   text in the design reference, **including the Second Brain placeholder exactly as shown**.
2. work-showcase.AC2 — Given a payload with two featured projects, no projects, a tenth project,
   three metrics on a non-featured project, an `http:` link, or duplicate tags in one project,
   when it is saved, then the response is 400 naming each path.
3. work-showcase.AC3 — Given a featured project, when the section renders at 1440, then it is a
   full-width card: badge, category, title, description and tags on the left and its metrics in
   a 2 × 2 panel on the right; at 390 the metric panel sits below the tags, still 2 × 2.
4. work-showcase.AC4 — Given the non-featured projects, when the section renders at 1440, then
   they form a three-column grid in list order, each card showing category, title, description,
   a divider with its metrics inline, and tags pinned to the bottom so tag rows align across a
   row; at 390 they stack in one column.
5. work-showcase.AC5 — Given a project with a `link`, when its card renders, then an arrow
   button in the card's top-right corner links to it in a new tab with
   `rel="noopener noreferrer"` and an accessible name containing the project title; given
   `link: null`, then no button is rendered.
6. work-showcase.AC6 — Given no project is featured, when the section renders, then all projects
   appear in the grid and no empty featured area is shown.
7. work-showcase.AC7 — Given 1, 2, 4 or 5 non-featured projects, when the grid renders at 1440,
   then cards keep one third of the width each and an incomplete last row is left-aligned.
8. work-showcase.AC8 — Given a project with no metrics, when its card renders, then the divider
   and the metric row are both omitted.
9. work-showcase.AC9 — Given the section, when it renders, then each project title is an `h3`
   under the section's `h2`, and metric values are in the accent colour with their labels in the
   muted colour.
10. work-showcase.AC10 — Given `/cms/sections/work`, when the owner edits, then projects are a
    reorderable list, marking one project featured clears the flag on any other, metric limits
    follow the featured state, and the preview reflects edits.
## Edge Cases Covered
- Un-featuring a project that has four metrics: the editor blocks the change until metrics are
  reduced to two — data is never trimmed silently.
- A description at the 400-character limit does not break card height alignment; cards in a row
  stretch to the tallest.
- A project whose only content is a title and category is valid.
- Text that looks like a placeholder is storable; whether it is publishable is decided by
  `publish-pipeline`.
## Error Handling
- Payload errors return through the engine in one 400.
- The "one featured" rule is enforced in the schema, not only in the editor.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| work-showcase.UT01 | AC2 | Schema with each invalid case in AC2 | One error per case |
| work-showcase.UT02 | AC1 | Definition defaults and seed file through the schema | Both valid; the seed's Second Brain description contains the bracketed placeholder |
| work-showcase.UT03 | AC3, AC6 | Render with and without a featured project | Featured card present / absent |
| work-showcase.UT04 | AC5 | Render a project with and without a link | Arrow link with the title in its name / none |
| work-showcase.UT05 | AC8 | Render a project with no metrics | No divider, no metric row |
| work-showcase.UT06 | AC10 | Editor reducer: feature project B while A is featured | Only B featured |
| work-showcase.UT07 | Edge | Editor reducer: un-feature a project with four metrics | Change rejected with a message |
## Open Questions
1. **OQ1 — Second Brain description.** The reference card still reads
   `[ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]`. Supply the sentence. Building is
   not blocked; the first publish is (`publish-pipeline.AC4`).
## Explicitly Out of Scope
- Project detail pages or case studies.
- Project images, screenshots or logos — none in the reference design.
- Filtering or tag search.
- More than one featured project.
## Non-Functional Constraints (from constitution.md)
- Links are `https:` only.
- No literal project content in the renderer.
