# blockers.md
## Open
- **Custom-domain TLS** — how an attached domain gets a certificate depends on the hosting
  target (BRD-007, BRD-011, open). `custom-domains` verifies ownership by DNS and routes by
  `Host`; issuing certificates is a deployment task and stays out of scope until hosting is
  chosen. Blocks nothing in code.
- **Express `trust proxy`** — must be set to the real hop count at deployment
  (`memory/review-findings.md`, 2026-10-18). Blocks nothing in code.

- **Explore across many sections on Gemini** — an explore request asks for a custom layout for
  every visible section (`design-library.AC7`), so a portfolio showing all six sends the six-tree
  schema Gemini refused with HTTP 400 (`design-library` → Status, 2026-10-21). One tree is known
  to be accepted; how many fit is unmeasured. Needs an owner decision: measure live, slim the
  tree schema, or explore fewer sections per request. Explore with one or two sections and
  every request without explore are unaffected.

## Resolved 2026-10-21
- ADR-0003 selection mechanics accepted as written — `ai-design-studio` may become `Ready`.
- Suspension takes a member's public portfolio offline until re-enabled (ADR-0010 → Owner
  answers, 2026-10-21).
- AI generations past the free monthly allowance spend one credit, shown before submitting;
  platform-fault failures give it back (ADR-0012 → Owner answers, 2026-10-21).
- Custom domains renew automatically from the balance, with a 14-day grace before detaching
  (ADR-0012 → Owner answers, 2026-10-21).

## Resolved 2026-10-20 (owner answered every open question in one session)
- ADR-0004 accepted, with a retention amendment (newest 20 snapshots per portfolio plus the
  live one). ADR-0005 accepted as written. ADR-0006 accepted, reading (a), amended to ship two or
  three layout variants per section in version 1.
- Module dependency cycles — `publishing` owns every shared port and imports neither
  `portfolio` nor `design` (ADR-0013); the map and `module-dependency-map.ts` follow.
- Build output and symlinks untracked (`git rm -r --cached`; files stay on disk).
- Owner role: admin area (list, suspend, re-enable members), unlimited credits, platform
  settings. Owner claim through the registration form only, never Google. A free portfolio is a
  path, `<platform>/<slug>`. New portfolios start from the reference design with empty content
  (ADR-0010, ADR-0011 → Owner answers).
- Payments: Stripe (ADR-0012). Credits buy a custom domain and AI generations beyond a free
  monthly allowance; prices and allowances are owner-edited platform settings with seeded
  defaults.
- Fonts (Inter, Instrument Serif, JetBrains Mono), accent `#c0f83c`, navigation and motion
  defaults, link targets and SEO text, the clipped hero lists — `design_reference.md` →
  Unknowns → Owner answers.
- Second Brain description — the owner fills it in from the CMS; publishing stays blocked until
  then (`publish-pipeline.AC4`). Does not block building.
- BRD-008 (résumé import) stays parked.
- Spec readiness — standing authorisation for the agent to move revised specs to `Ready`
  (`governance.md`).
