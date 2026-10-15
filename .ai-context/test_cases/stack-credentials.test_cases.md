# Test Cases: Stack and Credentials
**Spec:** .ai-context/specs/stack-credentials.spec.md
**Spec-derived unit cases:** UT01–UT06 are defined in the spec and not restated here.

## Integration (real MongoDB, through the section engine)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| stack-credentials.IT01 | AC1 | Seed, then read `stack` | Six groups, three education entries, two certifications |
| stack-credentials.IT02 | AC2 | PUT each invalid payload from AC2 | 400 with the expected path each time |

## End to end (Playwright)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| stack-credentials.E2E01 | AC9 | Add a chip to a group in the CMS and save | Preview and reload show it |
| stack-credentials.E2E02 | AC7 | Disable certifications in the CMS | Education card spans the row in the preview |

## Visual (Playwright baselines, approved by the owner against `docs/design-reference/`)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| stack-credentials.VR01 | AC3, AC4 | Stack at 1440 with seed content | Matches approved baseline |
| stack-credentials.VR02 | AC3 | Stack at 390 with seed content | Matches approved baseline |
| stack-credentials.VR03 | AC7 | Stack at 1440 with certifications disabled | Education full width; baseline |
| stack-credentials.VR04 | Edge | Stack at 1440 with seven groups | Last row left-aligned; baseline |

## Accessibility
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| stack-credentials.E2E03 | constitution | axe on the rendered section at 1440 and 390 | No serious or critical violations |

## Data variations
- 1 and 9 groups; 1 and 16 chips; education with and without `endYear` / `detail`; certification with and without URL.
- Text containing `<`, `&`, quotes and emoji renders literally.
