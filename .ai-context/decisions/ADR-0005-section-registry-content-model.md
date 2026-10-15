# ADR-0005: Typed sections behind a registry, one document per section
**Status:** Proposed — needs owner confirmation before `section-engine` becomes `Ready`

## Context
The reference page has six content sections with very different shapes. The CMS needs to edit
each one, reorder and hide them, and gain new section types later without rewriting the engine
(Open/Closed).

## Decision
One generic section engine. Each section type contributes a `SectionDefinition` (payload schema,
defaults, flags such as orderable/hideable, publish checks) registered in `SectionRegistry`. The
engine exposes generic endpoints keyed by `:type`; per-type payloads are owned by per-type specs.
Storage is one `sections` document per type per portfolio, each with its own `revision`; order
lives on the portfolio document. List items (projects, experience entries) are embedded arrays
with stable ids. Identity and design are separate modules, not section types, because they are
not page blocks.

## Consequences
- A new section type is added without editing the engine, its routes or the page composer.
- Per-section revisions keep edits to different sections from conflicting.
- One instance of each section type per page — two "work" sections are not possible without a
  later change to key sections by id.
- Embedded lists are bounded by the limits in each section spec, far below MongoDB's document
  size limit.
