# next.md
## Queued (build order, `project_context.md` → Feature slugs)
1. `ai-design-studio` — revise for ADR-0010 (per-user daily limits) and BRD-011 (free monthly
   allowance, then credits), build.
2. `platform-admin`, `credits-billing` (Stripe, ADR-0012), `custom-domains` — write the specs,
   then build.
3. At the deployment target: set Express `trust proxy` to the real hop count
   (`memory/review-findings.md`, 2026-10-18); measure the public page's first performance
   baseline and propose targets (`public-site-rendering` → Non-Functional Constraints).
