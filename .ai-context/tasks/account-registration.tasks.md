# Tasks: Account Registration
## Derived From
.ai-context/plans/account-registration.plan.md
## Sequence
- [x] account-registration.T01 — Contracts (`plainText`, API01–API05 payloads, `role` on `AuthUser`); `users` gains `role`, `emailVerifiedAt` and the owner partial index; `UserRepository` implements `IUserRegistrar` and `IOwnerLookup`; fakes and the user-repository contract suite extended; `email_verification` purpose — Acceptance: AC1, AC6 (index)
- [~] account-registration.T02 — `OwnerClaimPolicy`, `SessionStarter` (extracted from `AuthService.login`), `RegistrationService`; login refuses unverified accounts; password reset verifies the email; `OWNER_REGISTRATION_SECRET` in `env.ts`; seeder update — Acceptance: AC1–AC13, AC16
- [ ] account-registration.T03 — Controller handlers, routes API01–API05 with the shared code-send limiter, container wiring, OpenAPI 0.5.0, route tests over real MongoDB and Redis — Acceptance: AC1–AC15
