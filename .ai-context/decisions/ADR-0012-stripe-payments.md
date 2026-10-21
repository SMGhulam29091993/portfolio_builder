# ADR-0012: Credits are bought through Stripe Checkout and granted by a verified webhook
**Status:** Accepted — owner, 2026-10-20 (Stripe chosen as the payment provider; credits pay
for a custom domain and for AI generations beyond a free monthly allowance; prices and
allowances are platform settings the owner edits)

## Context
BRD-011 lets a user buy credits to publish on their own domain. `constitution.md` →
Infrastructure allows no payment provider without an ADR. The owner chose Stripe and decided
what credits buy: a custom domain, and AI design generations beyond a free monthly allowance.

## Decision
- **Provider.** Stripe, through hosted Stripe Checkout. Card data never touches this platform:
  the API creates a Checkout Session for a credit pack and redirects the browser to Stripe.
- **Granting.** Credits are granted only by the `checkout.session.completed` webhook, whose
  signature is verified with `STRIPE_WEBHOOK_SECRET` against the raw request body. The browser
  returning from Checkout grants nothing. Each Stripe event id is recorded, so a redelivered
  event grants once.
- **Ledger.** Credits are an append-only ledger (`credit_ledger`): a grant, a spend or an
  adjustment per entry, each with its reason; the balance is the sum. A spend is refused when
  the balance would go negative. The owner's account is never charged (ADR-0010).
- **Prices and allowances are data**, edited by the owner as platform settings: credit packs
  (credits and a Stripe Price id each), the custom-domain cost, the free monthly AI generations
  and the cost of one more. Defaults are seed data: custom domain 10 credits per year, 5 free AI
  generations per user per calendar month, 1 credit per extra generation.
- **Configuration.** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are environment variables.
  Same rule as mail (ADR-0009): outside production without them, the buy route answers 503 and
  everything else works; production refuses to start without them.
- **Adapter.** One `IPaymentGateway` port with a `StripePaymentGateway` adapter using the
  official `stripe` package (pinned in ADR-0007); no Stripe type crosses the port.

## Consequences
- `constitution.md` → Infrastructure lists Stripe as an approved integration for payments only.
- Refunds and disputes are handled in the Stripe dashboard; a refund does not claw credits back
  automatically (an owner adjustment entry does). Recorded as out of scope by `credits-billing`.
- Tests never call Stripe: the webhook route is exercised with events signed by a test secret,
  and the gateway behind a recording fake.

## Owner answers, 2026-10-21
- **AI generations beyond the free allowance.** The AI screen shows the free generations left
  this month and the credit cost before submitting; submitting a generation past the allowance
  spends the credit. With too few credits the request is refused with a link to buy credits. A
  generation that fails through the platform's or provider's fault (timeout, provider error,
  restart) gives its credit — or its free slot — back.
- **Custom-domain renewal.** A domain renews automatically from the balance each year. With too
  few credits it keeps serving for a 14-day grace period, then detaches; the portfolio stays at
  `<platform>/<slug>` throughout. The user is emailed before renewal and at expiry.

