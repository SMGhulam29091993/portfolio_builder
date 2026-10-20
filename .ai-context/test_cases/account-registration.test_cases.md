# Test Cases: Account Registration
## Derived From
.ai-context/specs/account-registration.spec.md
## Integration (real MongoDB + Redis, recorded mail) — `registration.routes.spec.ts`
| ID | Covers | Case |
|---|---|---|
| IT01 | AC1 | Register a new member: 200, unverified member stored, one code mailed |
| IT02 | AC2 | Register with a verified account's email: same body, nothing changed, nothing sent |
| IT03 | AC3 | Register twice while unverified: hash replaced, first reference dead |
| IT04 | AC4 | Owner claim with the right secret; options turn `ownerClaimOpen` false |
| IT05 | AC5 | Claim refused: owner exists / secret unset / wrong value; nothing written or sent |
| IT06 | AC6 | Two parallel correct claims: one owner, one 409 `OWNER_EXISTS` |
| IT07 | AC7 | Verify signs in: cookies set, session stored, role returned |
| IT08 | AC8 | Five wrong codes then the right one → `OTP_INVALID`; expired → `OTP_EXPIRED` |
| IT09 | AC9 | Login of an unverified account: 403 with right password, 401 with wrong |
| IT10 | AC10 | Verification request: real for unverified, decoy for unknown and verified |
| IT11 | AC11 | Resend cooldown 429 then rotation after 60 s |
| IT12 | AC12 | Cross-purpose references refused both ways |
| IT13 | AC13 | Password reset verifies the email |
| IT14 | AC14 | Shared send limit across five routes |
| IT15 | AC15 | No secret value in any log line |
## Unit — `registration.service.spec.ts`, `owner-claim.policy.spec.ts`
UT01–UT06 as listed in the spec.
## Seeder — `owner.seeder.spec.ts`
| ID | Covers | Case |
|---|---|---|
| IT16 | AC16 | Seeder creates a verified owner; a second seeded email becomes a member; an unverified seeded account is verified on rerun |
## Data variations
- `ownerSecret` absent, `""`, wrong, right, 201 characters (400).
- `displayName` `"<b>Ann</b>"` → `"Ann"`; `"   "` → 400; 81 characters → 400.
- `password` 11 characters → 400; 12 → accepted; 201 → 400.
