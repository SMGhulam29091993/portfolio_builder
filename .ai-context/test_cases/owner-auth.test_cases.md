# Test Cases: Owner Authentication
**Spec:** .ai-context/specs/owner-auth.spec.md
**Spec-derived unit cases:** UT01–UT09 are defined in the spec and not restated here.

## Integration (real MongoDB, real HTTP)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| owner-auth.IT01 | AC1 | Login with seeded credentials | 200; `Set-Cookie` for both cookies with `HttpOnly`, `SameSite=Strict`, correct `Path`; body has no token |
| owner-auth.IT02 | AC2 | Wrong password vs unknown email | Byte-identical 401 bodies |
| owner-auth.IT03 | AC3 | Six failed logins, same IP + email | Sixth → 429 with `Retry-After`; a different email from the same IP is not limited |
| owner-auth.IT04 | AC4 | Login → refresh | New cookies; old refresh hash marked rotated in `auth_sessions` |
| owner-auth.IT05 | AC5 | Refresh, wait past the grace window, replay the first token | 401; successor token also rejected afterwards |
| owner-auth.IT06 | AC6 | Login → logout → refresh | Logout 200; refresh 401 |
| owner-auth.IT07 | AC7 | Call a guarded test route with no / expired / tampered cookie | 401 each |
| owner-auth.IT08 | AC8 | POST login with no `Origin`, and with a foreign `Origin` | 403 `ORIGIN_NOT_ALLOWED` each |
| owner-auth.IT09 | AC9 | Run the owner seeder twice | One user; `passwordHash` unchanged on the second run |
| owner-auth.IT10 | AC11 | Capture logs across IT01–IT06 | No password, cookie, token or email substring present |
| owner-auth.IT11 | Edge | Session past `expiresAt` | Refresh → 401; TTL index definition present |
| owner-auth.IT12 | Edge | Login with the email in mixed case | 200 |

## Contract suites (one suite, every implementation)
| Test ID | Interface | Asserts |
|---|---|---|
| owner-auth.CT01 | `IPasswordHasher` | hash ≠ input; verify true for the right password, false for wrong; two hashes of one password differ |
| owner-auth.CT02 | `ITokenIssuer` | verify(sign(x)) = x; rejects expired, tampered and wrong-secret tokens; refresh tokens are 256-bit and unique |
| owner-auth.CT03 | `ISessionRepository` | create / findByHash / markRotated / revokeFamily behave identically for the Mongo and in-memory fake implementations |

## Data variations
- Passwords: 1 character, 200 characters, 201 characters (400), unicode, leading/trailing spaces (not trimmed).
- Emails: malformed (400), 255 characters (400).
