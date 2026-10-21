# next.md
## Queued (build order, `project_context.md` → Feature slugs)
1. `platform-admin`, `credits-billing` (Stripe, ADR-0012), `custom-domains` — write the specs,
   then build. `platform-admin` replaces `DefaultAiPricing` and `credits-billing` replaces
   `EmptyGenerationWallet` and fills `/cms/credits` (`ai-design-studio` → Status).
2. Owner decision: how explore fits Gemini when a portfolio shows many sections (`blockers.md`).
3. Owner, opt-in: `ai-design-studio.MT01` / `MT02` — one live generation per provider with real
   keys, to record durations and set `AI_TIMEOUT_MS` and the AI rate limit from measurements.
4. At the deployment target: set Express `trust proxy` to the real hop count
   (`memory/review-findings.md`, 2026-10-18); measure the public page's first performance
   baseline and propose targets (`public-site-rendering` → Non-Functional Constraints).
