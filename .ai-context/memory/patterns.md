# patterns.md — a reusable pattern seen in 2+ places

The patterns planned up front are in `.agent/rules/constitution.md` → Approved LLD patterns;
this file is for patterns that actually recur once code exists.

<!-- Template
### <pattern name>
**Where used:** <slug>, <slug>
**Shape:** ...
-->

## One-time code issuance (`owner-auth.T08`, `account-registration.T02`)
`PasswordResetService` and `RegistrationService` issue codes the same way: `mint()` (6-digit
code, 64-hex identifier, bcrypt of both in parallel) → `save()` (upsert by user and purpose,
`attempts` 0, map the reference in Redis) → send a plain-text email. Verification follows one
order: used up → expired (free) → claim an attempt atomically → compare. Every lookup checks
the record's `purpose`. A third purpose should extract this into one class rather than copy it
again (`account-registration` plan → Explicitly Deferred).

## A factory that owns the environment rule; adapters as registrations (`owner-auth.T07`, `ai-design-studio.T02`)
`MailSenderFactory` and `DesignGeneratorFactory` make the configuration decision in one class —
which adapter, what each needs set, the development-only fallback (disabled mail, the stub) and
the production refusal naming variables only — while `container.ts` supplies the adapters as
registrations (`MAIL_STRATEGIES`, `DESIGN_GENERATORS`). A new provider is one adapter class and
one registration line; the factory does not change. Both run inside `buildContainer`, so a bad
production configuration fails startup, and both have a test override in
`ContainerDependencies` (`mailSender`, `designGenerator`). A third integration with a choice of
provider should follow the same shape.

## Another module's data through a port the consumer owns, adapted inline in the container (`section-engine`, `ai-design-studio.T09`)
`portfolio` reads display names through its own `IUserDirectory`; `ai-design` reads visible
section types through `ISectionTypeLister` and roles through `IUserRoleReader`. Each port is
declared by the consuming module and implemented in `container.ts` as an object literal over the
other module's repository (`{ roleOf: async (id) => (await users.findById(id))?.role ?? null }`),
so neither module imports the other's classes and no dependency-map edge is added. Keep the
literal to a lookup and a mapping; anything with rules belongs in a class.
