# next.md
## Queued (build order, `project_context.md` → Feature slugs)
1. `account-registration` — write spec, plan, tasks, test cases (BRD-009, ADR-0010 and its
   owner answers), move to `Ready` under the standing authorisation, build.
2. `google-sign-in` (BRD-010, ADR-0011).
3. `section-engine` — revise for one portfolio per user and the reference design as the
   starting template; then build. Then `cms-panel-shell`, `site-identity`, `media-assets`,
   `design-theme`, the six section specs, `publish-pipeline`, `public-site-rendering`,
   `ai-design-studio`, `platform-admin`, `credits-billing`, `custom-domains`.
4. At the deployment target (carried from `owner-auth`): set Express `trust proxy` to the real
   hop count (`memory/review-findings.md`, 2026-10-18).
