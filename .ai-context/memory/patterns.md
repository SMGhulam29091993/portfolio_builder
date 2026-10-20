# patterns.md — a reusable pattern seen in 2+ places

No entries yet. The patterns planned up front are in `.agent/rules/constitution.md` → Approved
LLD patterns; this file is for patterns that actually recur once code exists.

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
