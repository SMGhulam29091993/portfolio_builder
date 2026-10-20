# Spec: Contact Section
## Spec ID
contact-section
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
  catalogue variants of `contact`: `glow-card` (the reference layout, the fallback) and `minimal`
  (`design-theme` → Variant catalogue), with the same payload; (3) renderers receive the
  identity through the page context (`packages/sections` `SectionContext`); (4) visual
  baselines are replaced by layout assertions in Playwright (element positions at 1440 and 390)
  plus axe: pixel baselines differ between macOS and CI's Linux and would need per-platform
  snapshots nobody has reviewed.
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Make the "05 Contact" card editable content of section type `contact`: a heading, a line of
body text, an email button, a copy-email chip and social links — with the email address and the
links taken from site identity. The reference design has no contact form, and this spec adds
none.
## Context
- Builds on: .ai-context/architecture.md (Section type catalogue)
- Related: .ai-context/specs/section-engine.spec.md, site-identity.spec.md
- Shared facts used: .ai-context/ownership_index.md (Section engine endpoints · Shared payload
  primitives · Identity payload); reference content: .ai-context/design_reference.md (05 Contact)
## API Contract
No endpoints of its own. This spec owns the `data` payload of `section-engine.API03` for
`:type = contact`.
```json
{ "meta": "SectionMeta",
  "heading": "EmphasisHeading",
  "body": "PlainText(200), optional",
  "emailCta": { "label": "PlainText(24)", "subject": "PlainText(120), optional" },
  "showCopyEmail": true,
  "showSocialLinks": true }
```
**Definition flags:** orderable, hideable, in nav.
## Acceptance Criteria
1. contact-section.AC1 — Given a seeded database, when the contact section is read, then it
   holds the reference content: eyebrow `Contact`, heading `Have something to build?` +
   `Let's talk.`, the body sentence, CTA label `Email me`, and both switches on.
2. contact-section.AC2 — Given a payload with an empty CTA label, a 201-character body or a
   121-character subject, when it is saved, then the response is 400 naming each path.
3. contact-section.AC3 — Given the section at 1440 and at 390, when it renders, then it is one
   rounded card with centred content in this order: eyebrow, heading, body, the button row,
   social links; with the theme's dot grid and a glow rising from the bottom edge when those
   effects are on.
4. contact-section.AC4 — Given the section, when it renders, then the heading's emphasis is in
   the display font and the accent colour, and the eyebrow is in the accent colour and centred.
5. contact-section.AC5 — Given the email button, when it is activated, then it opens
   `mailto:<identity.email>`, with the subject appended and URL-encoded when one is set.
6. contact-section.AC6 — Given `showCopyEmail: true`, when the chip is activated, then the
   identity's email is copied to the clipboard, the chip announces "Copied" to assistive
   technology and shows it visually for two seconds; given the clipboard is unavailable, then
   the email text is selected so it can be copied manually and no error is thrown.
7. contact-section.AC7 — Given the page at 390, when the chip renders, then a long address is
   truncated with an ellipsis visually while its accessible name and the copied value remain the
   full address.
8. contact-section.AC8 — Given `showSocialLinks: true`, when the section renders, then each
   identity social appears as an icon with its platform name as visible text, opening in a new
   tab with `rel="noopener noreferrer"`; given the identity has none, then the row is absent.
9. contact-section.AC9 — Given `/cms/sections/contact`, when the owner edits, then the form
   shows the identity's email read-only with a link to `/cms/identity`, and the preview reflects
   edits.
## Edge Cases Covered
- `showCopyEmail: false` centres the single button.
- An empty `body` removes the paragraph without leaving a gap.
- A subject containing `&`, `?` or non-ASCII characters is encoded correctly.
- The email address is rendered as text and in a `mailto:` only — it is never fetched.
## Error Handling
- Payload errors return through the engine in one 400.
- Clipboard failure is handled in the component (AC6); it is not surfaced as an error toast.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| contact-section.UT01 | AC2 | Schema with each invalid case in AC2 | One error per case |
| contact-section.UT02 | AC1 | Definition defaults and seed file through the schema | Both valid |
| contact-section.UT03 | AC5 | `buildMailto(email)` and with subject `Hello & welcome?` | `mailto:…`; correctly encoded `subject=` |
| contact-section.UT04 | AC6 | Copy with a working and a throwing clipboard | "Copied" announced; text selected, no throw |
| contact-section.UT05 | AC7 | Render the chip | Full address in the accessible name |
| contact-section.UT06 | AC8 | Render with zero and two socials | Row absent / two labelled links |
## Explicitly Out of Scope
- A contact form, message storage, email sending, spam protection — none in the reference design.
- A calendar or scheduling embed.
- Obfuscating the email address against scrapers.
## Non-Functional Constraints (from constitution.md)
- The email address is PII: present in published content by the owner's choice, never logged.
- Text and background inside the card meet the contrast floors with the glow effect on.
