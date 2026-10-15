# Business Requirements Log

One entry per requirement, written before any spec. Source for every entry unless noted: the
owner's request of 2026-10-11 and the two attachments (`Ghulam Portfolio.html`,
`SMGhulam_Resume_NEW.pdf`).

### BRD-001: Edit the portfolio from a CMS panel instead of code
**Raised by:** S M Ghulam Ghaus Faiyaz (owner)
**Business need:** The portfolio in the reference design changes as projects, roles and skills
change. Each change should be a form edit in a panel, not a code change and redeploy.
**Sponsor:** Owner
**Priority:** P0 — no deadline set
**Decided:** Every block of the reference page is editable content. A single owner; a single
portfolio.
**Open at BRD stage:** Whether the product will later serve other users (multi-tenant).
**Notes:** Scope is the six sections and the shell in `design_reference.md`. A blog, a contact
form and analytics are not part of the reference design and are out of scope.

### BRD-002: Only the owner can change the portfolio
**Raised by:** Owner
**Business need:** The CMS controls a public site; it must not be editable by anyone else.
**Sponsor:** Owner
**Priority:** P0
**Decided:** One owner account, created by a seeder from environment variables. No public
sign-up.
**Open at BRD stage:** Two-factor authentication; password reset by email.
**Notes:** The AI providers are never a login path.

### BRD-003: The published site matches the reference design
**Raised by:** Owner
**Business need:** The site visitors see must look like the attached design at desktop (1440)
and phone (390) widths, and stay usable in between.
**Sponsor:** Owner
**Priority:** P0
**Decided:** The two boards in `docs/design-reference/` are the visual source of truth. The
footer of the design names the front-end stack: Next.js, Tailwind, Motion.
**Open at BRD stage:** Font families, exact accent colour, all motion and hover behaviour, and
mobile navigation — none is recoverable from the export (`design_reference.md` → Unknowns).
**Notes:** The design is expressed as theme tokens and layout variants so it can change without
code.

### BRD-004: Use AI to generate UI designs for the portfolio
**Raised by:** Owner
**Business need:** Produce new looks for the portfolio from a prompt rather than hand-tuning.
**Sponsor:** Owner
**Priority:** P1
**Decided:** Gemini or OpenRouter in deployed environments; Ollama models for local development.
**Open at BRD stage:** What "UI design" covers. This spec set reads it as theme tokens plus a
choice among built layout variants, validated before use (ADR-0006, *Proposed*). Free-form
generated markup is the alternative and is not specified.
**Notes:** Switching provider is configuration, not a code change.

### BRD-005: Publishing is deliberate, checked and reversible
**Raised by:** Owner ("published from a portfolio builder CMS panel")
**Business need:** Edits must not reach visitors half-finished, and a bad publish must be
undoable.
**Sponsor:** Owner
**Priority:** P0
**Decided:** Draft and published content are separate; publishing validates first.
**Open at BRD stage:** Scheduled publishing; restoring an old version back into the draft.
**Notes:** The reference content contains an unfilled placeholder in the Second Brain card —
exactly what a publish check has to catch.

### BRD-006: Visitors can download the résumé
**Raised by:** Owner (the nav's `Résumé` button; the résumé PDF attachment)
**Business need:** The nav offers a résumé; the owner must be able to replace the file without
a deploy.
**Sponsor:** Owner
**Priority:** P1
**Decided:** PDF upload through the CMS.
**Open at BRD stage:** Production file storage. Files live in MongoDB GridFS until an ADR
approves another store.
**Notes:** The résumé PDF contains a phone number; the site does not publish it as a field.

### BRD-007: A backend that stays maintainable as it grows
**Raised by:** Owner
**Business need:** "The backend will follow strictly modular architecture, with SOLID principles
as its base rule; nothing goes against it," using low-level design patterns that keep it
scalable.
**Sponsor:** Owner
**Priority:** P0 — constrains every other requirement
**Decided:** Turborepo monorepo. Next.js, Node.js + Express, TypeScript, MongoDB. No Gate 1 /
Gate 2 reviewers on this project (ADR-0001).
**Open at BRD stage:** Hosting and deployment targets.
**Notes:** Encoded in `.agent/rules/constitution.md`; every plan checks against it.

### BRD-008: Pre-fill the portfolio from a résumé (parked — not requested)
**Raised by:** Inferred by the agent from the résumé attachment; **not asked for by the owner**
**Business need:** Possibly: upload a résumé PDF and have AI draft the section content.
**Sponsor:** None yet
**Priority:** Unprioritised
**Decided:** Nothing. No spec exists and none may be written until the owner confirms this is
wanted.
**Open at BRD stage:** Whether it is wanted at all.
**Notes:** In this spec set the résumé is used only as the source of link targets and to
cross-check the reference content.
