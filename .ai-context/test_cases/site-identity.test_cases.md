# Test Cases: Site Identity
**Spec:** .ai-context/specs/site-identity.spec.md
**Spec-derived unit cases:** UT01–UT07 are defined in the spec and not restated here.

## Integration (real MongoDB, real HTTP)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| site-identity.IT01 | AC1 | GET after seeding | Reference values present |
| site-identity.IT02 | AC2, AC3 | PUT valid; PUT again with the old revision | 200; 409 |
| site-identity.IT03 | AC4 | PUT with four invalid fields at once | One 400 listing four paths |
| site-identity.IT04 | AC5 | PUT with an uploaded image's id as the résumé | 400 at `resume.assetId` |
| site-identity.IT05 | AC5 | PUT with an uploaded PDF's id as the résumé | 200 |
| site-identity.IT06 | AC7 | PUT including `phone` | 200; `phone` absent from the DB document |
| site-identity.IT07 | AC9 | Seed, edit, seed | Edit preserved |
| site-identity.IT08 | Auth | GET and PUT with no cookie | 401 |

## End to end
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| site-identity.E2E01 | AC10 | Upload a PDF in Assets, select it as the résumé, save | Saved; select lists only résumé assets |

## Data variations
- Monogram: `G`, `GF`, `GF1`, `gf`, `GFXY`, empty.
- Socials: none, one per platform (four), a fifth with a repeated platform.
- Email: upper-case input is stored lower-case.
