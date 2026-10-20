# ADR-0010: Many user accounts, each building its own portfolio; one owner claimed once by a secret key
**Status:** Accepted for the product decision — owner, 2026-10-18 (registration for every user,
email verification required, the owner account claimed once with a secret key, the seeder
kept for development only) · mechanics *Proposed* (role field, index, endpoint shapes; see
Decision → Mechanics)

## Context
Until 2026-10-18 the product was single-owner: BRD-001 decided "a single owner; a single
portfolio" and left multi-tenancy open, BRD-002 decided "one owner account, created by a seeder
… no public sign-up", and `owner-auth.T09` was to build that seeder. While starting T09 the
spec turned out not to say where the required `users.displayName` comes from. Asked, the owner
answered with a different product (2026-10-18):

- There is a registration form for every user, the owner included.
- The owner registers with an owner secret key. Once it has been given and validated, the key
  is removed from (or hidden on) the registration form.
- Other users build their own portfolio. A user who buys credits publishes on their own domain
  name; a free user publishes on the CMS's own domain.
- Email verification is required at registration, and Google sign-in is offered (ADR-0011).
- The environment-variable seeder stays, for development only.

## Decision
- **Accounts.** Anyone may register. Every account is a `users` record; `users` stays the only
  source of authentication (`agent-role.md` → Auth). An account is not usable for the CMS until
  its email is verified.
- **Two roles.** `owner` — the platform owner, at most one, ever — and `member` — everyone
  else. A registration that carries the correct owner secret key, while no owner exists,
  creates the owner. Once an owner exists the key is refused for good, whatever is sent, and
  the form stops offering the field. "Removed or hidden" is enforced by the server, not only by
  the form.
- **Tenancy.** Every user builds their own portfolio. The `portfolioId` that every content
  document already carries (`int-standards.express.md` → Persistence conventions) becomes the
  tenant boundary: a `/api/v1/cms/**` request acts only on portfolios its signed-in user owns.
- **Hosting.** A free user's portfolio is served on the platform's own domain; a user who buys
  credits can attach their own domain. Credits, payment and custom domains are product
  requirements (BRD-011) with no decision on provider or mechanics yet.
- **Seeder.** The `OWNER_EMAIL` / `OWNER_PASSWORD` seeder (`owner-auth.T09`) creates a local
  account for development and tests only and refuses to run when `NODE_ENV=production`.

### Mechanics (fixed by the `account-registration` spec, implemented 2026-10-20)
- `users.role` (`owner` | `member`) and `users.emailVerifiedAt`; a unique partial index on
  `{ role: 1 }` where `role = "owner"`, so the database itself rejects a second owner when two
  registrations race.
- The owner secret is configuration (`OWNER_REGISTRATION_SECRET`), compared in constant time,
  never logged and never stored.
- A public read endpoint tells the registration form whether the owner slot is still open.
- Email verification reuses the one-time-code machinery of `owner-auth` with a new `purpose`.
- Registration answers identically for a new and an already-registered email (no enumeration),
  behind the Origin allow-list and a rate limiter.

### Owner answers, 2026-10-20 (close the questions this ADR left open)
- **What the owner role may do.** Three things a member may not: (1) an admin area that lists
  every account and suspends or re-enables a member — a suspended member cannot sign in and
  their published portfolio stops being served; (2) unlimited credits — the owner is never
  charged for a custom domain or an AI generation; (3) platform settings — the owner edits the
  platform-wide values (credit packs, prices, allowances) that would otherwise be constants.
- **The owner claim** is made only through the registration form with the secret key. Google
  sign-in never creates the owner (ADR-0011).
- **A free portfolio's address** is a path on the platform's domain: `<platform>/<slug>`, where
  `slug` is the portfolio's unique slug. The platform's own origin is configuration.
- **Template.** Every new user's portfolio starts from the reference design (theme and layout)
  with empty placeholder content; the reference content is seed data for the owner's
  development account only.

## Consequences
- BRD-001 and BRD-002 are revised; BRD-009 (registration), BRD-010 (Google sign-in) and BRD-011
  (credits and custom domains) are added.
- `owner-auth` keeps everything T01–T08 built (sign-in, the single session per user, the guard,
  password reset), all of which already works per user. It is revised: T09 becomes a
  development-only seeder.
- New feature slugs: `account-registration` and `google-sign-in` (after `owner-auth`),
  `credits-billing` and `custom-domains` (after `public-site-rendering`). None is written yet.
- Specs already written for one owner and one portfolio need revising when they are picked up:
  `section-engine` (portfolio per user, ownership check on `/cms`), `cms-panel-shell`
  (registration and verification screens), `site-identity`, `media-assets` (bytes served to
  the asset's own user), `design-theme`, `publish-pipeline` (snapshot volume is no longer one
  owner's, which ADR-0004 → Consequences relied on for "no pruning"), `public-site-rendering`
  (which portfolio a request host serves) and `ai-design-studio` (per-user limits).
- `agent-role.md` → Route audiences and `constitution.md` → Security Posture are amended to the
  decided facts above. The mechanics stay out of the rule files until they are accepted.
- Open, recorded in `state/blockers.md`: what the owner role may do that a member may not; the
  payment provider and what credits buy; the shape of a free portfolio's address on the
  platform domain; whether the reference design becomes a template for every user.
