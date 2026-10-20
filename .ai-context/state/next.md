# next.md
## Queued (build order, `project_context.md` → Feature slugs)
1. `site-identity` — revise for ADR-0010 (per-user identity; SEO answers of 2026-10-20), build.
2. `media-assets`, `design-theme` (fonts and accent answered; variant catalogue per ADR-0006
   amendment), then the six section specs (`about-section` first: it also runs the CMS editing
   E2E05–E2E09 handed on by `cms-panel-shell`), `publish-pipeline` (fills the header's publish
   status, `cms-panel-shell.AC11`), `public-site-rendering`, `ai-design-studio`,
   `platform-admin`, `credits-billing`, `custom-domains`.
3. At the deployment target (carried from `owner-auth`): set Express `trust proxy` to the real
   hop count (`memory/review-findings.md`, 2026-10-18).
