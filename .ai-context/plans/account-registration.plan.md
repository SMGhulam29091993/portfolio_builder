# Plan: Account Registration
## Derived From
.ai-context/specs/account-registration.spec.md
## Architecture Approach
All of it lives in the existing `auth` module: `users` and `otps` have one writer, `auth`
(`architecture.md` → Data ownership). No new module, no new dependency edge.
| Class | Layer | Implements | Depends on (interfaces) |
|---|---|---|---|
| `RegistrationService` | Service | `IRegistrationService` (options, register, verify, requestCode, resend) | `IUserReader`, `IUserRegistrar`, `IOtpRepository`, `IOtpReferenceStore`, `IOtpHasher`, `IPasswordHasher`, `IMailSender`, `ISecureRandom`, `IClock`, `IOwnerClaimPolicy`, `ISessionStarter` (`AuthService`) |
| `OwnerClaimPolicy` | Service | `IOwnerClaimPolicy` (isOpen, decide) | `IOwnerLookup`, the configured secret (constructor option) |
| `UserRepository` | Repository | adds `IUserRegistrar` (createPending, updatePending, markEmailVerified) and `IOwnerLookup` (ownerExists) | `users` model |
| `AuthController` | Controller | gains five handlers | `IRegistrationService` |
- `AuthService` also implements `ISessionStarter` (`startFor(user)`), which its own `login`
  calls after a successful password verify and the `emailVerifiedAt` check
  (`EmailNotVerifiedError`, 403); registration's verify signs in through the same method, so a
  session is minted in one place (decided in T02 instead of a separate class: the minting and
  the store it writes are already `AuthService`'s).
- `PasswordResetService.reset` calls `IUserRegistrar.markEmailVerified` after the password write,
  and its reference lookup refuses a code of another purpose (AC12).
- The development seeder (`OwnerSeeder`) gains `IUserRegistrar`, `IOwnerLookup` and `IClock`.
- The code mint/save/send steps repeat `PasswordResetService`'s with another purpose; named in
  `memory/patterns.md` (one-time code issuance) instead of refactoring tested T08 code.
- Errors: `EmailNotVerifiedError` (403 `EMAIL_NOT_VERIFIED`), `OwnerClaimRefusedError` (403
  `OWNER_CLAIM_REFUSED`), `OwnerExistsError` (409 `OWNER_EXISTS`) in `auth.errors.ts`.
- `plainText(max)` — the shared free-text schema helper (`int-standards.express.md` → Input
  validation) — is created in `packages/contracts/src/common/` for `displayName`; section
  payloads reuse it.
## Data Model
- `users` gains `role` (`owner` | `member`, default `member`) and `emailVerifiedAt?: Date`.
  Index: `{ role: 1 }` unique, partial filter `{ role: "owner" }`.
- `otps.purpose` gains `email_verification`.
- No Redis change: references use the existing `auth:otp-ref:*` keyspace.
- Seed: the development seeder sets `emailVerifiedAt` and `role` (owner when none exists).
## Environment
- `OWNER_REGISTRATION_SECRET` (api, optional, 32–200 characters when set). Row in
  `architecture.md` → Environment, `.env.example`, `turbo.json`.
## Constitution Check
- [x] Class-based, layers respected, constructor injection, wired only in `container.ts`.
- [x] `users` has one writer (`auth`); no new edge.
- [x] Secrets from `env.ts` only; the secret is never logged or stored.
- [x] Test-first: routes, the claim logic and login change.
- [x] Real MongoDB / Redis in repository and route tests; mail recorded, never sent.
## Explicitly Deferred
- Purging never-verified accounts — not needed for correctness (spec → Out of Scope).
- A shared one-time-code service for password reset and verification — a refactor of tested
  code with no behaviour change; revisit when a third purpose arrives.
