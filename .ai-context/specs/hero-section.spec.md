# Spec: Hero Section
## Spec ID
hero-section
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
  catalogue variants of `hero`: `split-code-card` (the reference layout, the fallback) and `centered`
  (`design-theme` → Variant catalogue), with the same payload; (3) renderers receive the
  identity through the page context (`packages/sections` `SectionContext`); (4) visual
  baselines are replaced by layout assertions in Playwright (element positions at 1440 and 390)
  plus axe: pixel baselines differ between macOS and CI's Linux and would need per-platform
  snapshots nobody has reviewed.
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Make the top of the page — headline, introduction, two call-to-action buttons, social icons,
the `ghulam.config.ts` code card and the scrolling tech strip — editable content of section type
`hero`, rendered to match the reference at 1440 and 390, with the owner's name, availability,
socials and location taken from site identity rather than typed again.
## Context
- Builds on: .ai-context/architecture.md (Section type catalogue)
- Related: .ai-context/specs/section-engine.spec.md, site-identity.spec.md, design-theme.spec.md
- Shared facts used: .ai-context/ownership_index.md (Section engine endpoints · Shared payload
  primitives · Identity payload); reference content: .ai-context/design_reference.md (Hero)
## API Contract
No endpoints of its own. This spec owns the `data` payload of `section-engine.API03` for
`:type = hero`, and the same shape inside `section-engine.API01`.
```json
{ "heading": "EmphasisHeading",
  "intro": { "prefix": "PlainText(40), optional", "showName": true, "body": "PlainText(280)" },
  "primaryCta": { "label": "PlainText(24)", "target": "LinkTarget" },
  "secondaryCta": "{ label, target } | null",
  "showAvailability": true,
  "showSocialIcons": true,
  "codeCard": { "enabled": true, "filename": "PlainText(40)", "exportName": "Identifier(24)",
                "showLocation": true,
                "entries": [ { "id": "ItemId", "key": "Identifier(20)",
                               "value": "PlainText(80) | PlainText(24)[]" } ] },
  "marquee": { "enabled": true, "items": ["Tag"] } }
```
Limits: `codeCard.entries` 1..8 with unique keys; an array `value` holds 1..8 items;
`marquee.items` 4..24, unique. `Identifier(n)` matches `^[A-Za-z_][A-Za-z0-9_]*$`, ≤ n. A
`LinkTarget` of kind `section` may not point at `hero`.
**Definition flags:** not orderable (always first), not hideable, not in nav.
**Validation failures** surface as `section-engine.API03` → 400 `VALIDATION_FAILED`.
## Acceptance Criteria
1. hero-section.AC1 — Given a seeded database, when the hero section is read, then it holds the
   reference content: heading `I build AI-powered products that` + `ship in days.`, the intro,
   CTAs `See my work` → `work` and `Get in touch` → `contact`, the six code-card entries and the
   marquee items listed in the design reference.
2. hero-section.AC2 — Given a payload with a key that is not an identifier, two entries with the
   same key, a ninth entry, an array value with nine items, three marquee items, duplicate
   marquee items, or a CTA targeting `hero`, when it is saved, then the response is 400 naming
   each path.
3. hero-section.AC3 — Given the page at 1440, when the hero renders, then the text column is on
   the left and the code card on the right, vertically centred against each other, with the
   marquee strip full-width beneath; given 390, then everything is one column in this order:
   availability badge, heading, intro, buttons, social icons, code card, marquee.
4. hero-section.AC4 — Given the hero, when it renders, then the heading is the page's only
   `h1`, and its `emphasis` part is set in the display font and the accent colour.
5. hero-section.AC5 — Given `intro.showName: true`, when the intro renders, then it reads
   prefix, the identity's `fullName` in the primary text colour, an em dash, then the body;
   given `false`, then the name and the dash are omitted.
6. hero-section.AC6 — Given `showAvailability: true` and identity `availability.enabled: true`,
   when the hero renders, then the badge shows the identity's availability label; given either
   is false, then no badge is rendered.
7. hero-section.AC7 — Given a CTA with a `section` target, when it is activated, then the page
   moves to that section's anchor and moves focus to its heading; given a `url` target, then it
   opens in a new tab with `rel="noopener noreferrer"`.
8. hero-section.AC8 — Given `showSocialIcons: true`, when the hero renders, then each identity
   social appears as an icon link whose accessible name states the platform; given the identity
   has no socials, then no icon row is rendered.
9. hero-section.AC9 — Given `codeCard.enabled: true`, when it renders, then it shows a window
   title bar with `filename`, the line `export const <exportName> = {`, one line per entry with
   the key in the accent colour, string values quoted and array values as a bracketed quoted
   list, and a closing brace; a line longer than the card scrolls inside the card and never
   widens the page.
10. hero-section.AC10 — Given `codeCard.showLocation: true`, when the card renders, then its
    footer shows the identity's location label and timezone label separated by a middle dot.
11. hero-section.AC11 — Given `marquee.enabled: true`, when it renders, then the items appear on
    one line in the mono font separated by accent dots with both edges faded; any items
    repeated to fill the loop are hidden from assistive technology; and when motion is `none` or
    the visitor prefers reduced motion, then the strip is static.
12. hero-section.AC12 — Given `/cms/sections/hero`, when the owner edits, then every field above
    has a control, each code-card value can be switched between text and list, list limits
    disable Add at the maximum, and the preview reflects edits.
## Edge Cases Covered
- `secondaryCta: null` → one button. `codeCard.enabled: false` → the text column spans the
  width at 1440. `marquee.enabled: false` → no strip, no empty gap.
- A CTA targeting a section that is hidden: allowed in the draft; `publish-pipeline` blocks it.
- A very long `fullName` or heading wraps without overflowing at 390.
- An empty optional `prefix` leaves no leading space.
## Error Handling
- All payload errors come back through the engine in one 400.
- Missing identity fields at render (no location) simply omit that element; the hero never
  throws on absent optional data.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| hero-section.UT01 | AC2 | Schema with each invalid case in AC2 | One error per case at the right path |
| hero-section.UT02 | AC1 | `HeroSectionDefinition.defaults()` and the seed file through the schema | Both valid |
| hero-section.UT03 | AC5 | Render with `showName` true / false | Name + dash present / absent |
| hero-section.UT04 | AC6 | Four combinations of the two availability flags | Badge only when both true |
| hero-section.UT05 | AC9 | Render a string entry and an array entry | `"…"` and `["a", "b"]` formatting |
| hero-section.UT06 | AC11 | Render with motion `none` | No animation props; duplicates `aria-hidden` |
| hero-section.UT07 | AC4 | Count `h1` in the rendered hero | Exactly one |
## Open Questions
1. **OQ1 — Clipped values.** Both boards cut off the code card's `stack` array after
   `"Postgres"` and fade the marquee at both edges. Supply the full array and the full marquee
   list; the seed holds only what is visible.
2. **OQ2 — Motion.** Marquee direction, speed and pause-on-hover, and any entrance animation,
   are not visible in a still image. Until specified, `subtle` and `full` both render a slow
   leftward loop that pauses on hover and focus, and there is no entrance animation.
## Explicitly Out of Scope
- The nav pill above the hero — `public-site-rendering`.
- A hero image or avatar — none in the reference design.
- Real syntax highlighting or an editable code block for visitors.
- Additional hero variants.
## Non-Functional Constraints (from constitution.md)
- No literal content, colour or font in the renderer.
- Reduced motion is honoured.
- All text rendered as text; no HTML from stored data.
