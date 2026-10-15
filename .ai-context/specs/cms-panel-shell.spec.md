# Spec: CMS Panel Shell
## Spec ID
cms-panel-shell
## Status
Draft
## Linked BRD
.ai-context/BRD.md#BRD-001
## Intent
Build the CMS panel's frame in `apps/web`: sign-in, session handling, navigation, a generic
host that turns any registered section type into an editing screen, shared form behaviour
(validation, save, conflict, unsaved-changes guard), and a live preview that renders the draft
through the same components as the public site at the two reference widths. Feature specs add
editors into this shell; they do not rebuild any of it.
## Context
- Builds on: .ai-context/architecture.md (Repository layout → `apps/web`, Section type catalogue)
- Related: .ai-context/specs/owner-auth.spec.md, section-engine.spec.md, publish-pipeline.spec.md
- Shared facts used: .ai-context/ownership_index.md (Session contract · Section engine endpoints ·
  Optimistic concurrency · Section type catalogue)
## API Contract
None of its own. Consumes `owner-auth.API01`–`API04`, `section-engine.API01`–`API05` and
`publish-pipeline.API01`.
## Screens
| Route | Purpose |
|---|---|
| `/cms/login` | Sign in |
| `/cms` | Overview: section list with visibility and order, publish status |
| `/cms/sections/[type]` | Section editor host + live preview |
| `/cms/identity`, `/cms/design`, `/cms/assets`, `/cms/ai`, `/cms/publish` | Mount points filled by `site-identity`, `design-theme`, `media-assets`, `ai-design-studio`, `publish-pipeline` |
## Acceptance Criteria
1. cms-panel-shell.AC1 — Given no session, when any `/cms/**` route except `/cms/login` is
   opened, then the browser is redirected to `/cms/login?next=<path>`; and after a successful
   sign-in it lands on `next` only if `next` is a same-origin path starting with `/cms`,
   otherwise on `/cms`.
2. cms-panel-shell.AC2 — Given the login form, when credentials are rejected, then one generic
   inline error is shown; when the API answers 429, then the form shows how long to wait and
   disables submit until then; the password is never placed in a URL or in client logs.
3. cms-panel-shell.AC3 — Given an expired access cookie, when any CMS request returns 401, then
   the client calls refresh once and retries the request once; given the retry also returns 401,
   then the user is sent to `/cms/login` with the current path as `next`.
4. cms-panel-shell.AC4 — Given the section types returned by `section-engine.API02`, when the
   navigation renders, then it lists them in portfolio order followed by the fixed entries
   (Identity, Design, Assets, AI Studio, Publish); and given a type with no registered editor,
   then its screen shows "No editor is available for this section" instead of failing.
5. cms-panel-shell.AC5 — Given a section editor, when it opens, then the form is populated from
   the draft; the Save button is disabled until the form is both changed and valid; and on a
   successful save the stored revision is updated and a confirmation is announced.
6. cms-panel-shell.AC6 — Given a save answered with 400 `VALIDATION_FAILED`, when the response
   arrives, then each error is attached to the field at its path, focus moves to the first
   invalid field, and no data is lost.
7. cms-panel-shell.AC7 — Given a save answered with 409 `REVISION_CONFLICT`, when the response
   arrives, then a dialog offers "Load latest" (discard local edits) and "Overwrite with mine"
   (resubmit against `currentRevision`); nothing is overwritten without that explicit choice.
8. cms-panel-shell.AC8 — Given unsaved changes, when the user navigates within the CMS, closes
   the tab or signs out, then a confirmation is required before the changes are discarded.
9. cms-panel-shell.AC9 — Given a section editor, when a field changes, then within 300 ms the
   preview shows the saved draft with the current unsaved values of that section applied,
   rendered by `packages/sections` using the draft design; and a toggle switches the preview
   between a 1440-wide and a 390-wide frame, each scaled to fit the pane.
10. cms-panel-shell.AC10 — Given the overview, when a hideable section's switch is toggled or
    sections are reordered by drag or by the keyboard move-up / move-down controls, then
    `section-engine.API04` / `API05` is called and the list reflects the result; `hero` shows
    neither control.
11. cms-panel-shell.AC11 — Given `publish-pipeline.API01`, when the shell header renders, then it
    shows the published version and time or "Never published", an "Unpublished changes" badge
    when the hashes differ, and a link to `/cms/publish`.
12. cms-panel-shell.AC12 — Given any `/cms/**` page, when it is served, then it carries
    `noindex, nofollow` and is absent from the sitemap.
13. cms-panel-shell.AC13 — Given a list field (projects, steps, entries), when it is edited,
    then items can be added, removed after confirmation and reordered with mouse and keyboard;
    "Add" is disabled at the schema's maximum and "Remove" at its minimum.
14. cms-panel-shell.AC14 — Given keyboard-only use, when the user signs in, opens a section,
    edits a field and saves, then every step is reachable with a visible focus indicator, and
    automated accessibility checks report no serious or critical violation on each CMS screen.
## Edge Cases Covered
- Network failure on save: the form stays dirty, an error with Retry is shown, nothing is lost.
- The API is unreachable on load: a full-pane error with Retry, not a blank screen.
- Preview data that fails to render (a renderer throws): an error boundary shows the failing
  section's name; the editor remains usable.
- A narrow CMS viewport (below 1024): the preview collapses behind a toggle; forms stay usable.
- Two tabs: covered by AC7.
- An open `next` parameter pointing off-site: ignored (AC1).
## Error Handling
- Errors are mapped from `data.code`, never from message text.
- 401 → refresh-then-login flow (AC3). 403 `ORIGIN_NOT_ALLOWED` → a configuration error screen.
- 429 → show the wait time from `retryAfterSec`. 5xx → generic failure with Retry.
- Every async state has a loading, an empty and an error rendering.
## Unit Test Cases (spec-derived)
| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| cms-panel-shell.UT01 | AC1 | `safeNext()` with `/cms/design`, `//evil.example`, `https://evil.example`, `/other` | First kept; others → `/cms` |
| cms-panel-shell.UT02 | AC3 | API client: 401 then success after refresh | One refresh, one retry, resolves |
| cms-panel-shell.UT03 | AC3 | API client: 401, refresh, 401 again | Rejects with a session-expired error; no third call |
| cms-panel-shell.UT04 | AC4 | Editor registry lookup for a registered and an unregistered type | Component / fallback |
| cms-panel-shell.UT05 | AC6 | Map `errors[{path:"projects.1.title"}]` onto form state | Error set on that field |
| cms-panel-shell.UT06 | AC9 | Preview model: saved draft + unsaved values for one section | Only that section's data replaced |
| cms-panel-shell.UT07 | AC13 | `ListField` at max and at min | Add disabled; Remove disabled |
## Explicitly Out of Scope
- The field-level editor for each section, identity, design, assets, AI and publish screens —
  their own specs.
- Autosave. Saves are explicit.
- Multi-user presence or locking.
- A CMS theme switcher; localisation.
## Non-Functional Constraints (from constitution.md)
- WCAG 2.1 AA on every CMS screen.
- The preview renders with `packages/sections` — no CMS-only copy of a renderer.
- Tokens stay in HttpOnly cookies; nothing auth-related in browser storage.
