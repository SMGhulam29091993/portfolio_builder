# Test Cases: About Section
**Spec:** .ai-context/specs/about-section.spec.md
**Spec-derived unit cases:** UT01–UT07 are defined in the spec and not restated here.

## Integration (real MongoDB, through the section engine)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| about-section.IT01 | AC1 | Seed, then read `about` | Reference content present |
| about-section.IT02 | AC2 | PUT each invalid payload from AC2 | 400 with the expected path each time |
| about-section.IT03 | AC2 | PUT `process.enabled: false` with one step | 200 |

## End to end (Playwright)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| about-section.E2E01 | AC8 | Remove a stat in the CMS and save | Preview grid shows three cards, no placeholder |
| about-section.E2E02 | AC6 | Reorder process steps in the CMS | Numbers follow the new order |

## Visual (Playwright baselines, approved by the owner against `docs/design-reference/`)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| about-section.VR01 | AC3 | About at 1440 with seed content | Matches approved baseline |
| about-section.VR02 | AC3 | About at 390 with seed content | Matches approved baseline |
| about-section.VR03 | AC5 | About at 1440 with three stats | No empty card; baseline |
| about-section.VR04 | AC7 | About at 1440 with the process card disabled | No gap; baseline |

## Accessibility
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| about-section.E2E03 | constitution | axe on the rendered section at 1440 and 390 | No serious or critical violations |

## Data variations
- Bio at 600 characters; 0–4 stats; 2–4 steps; no note; both optional cards disabled.
- Text containing `<`, `&`, quotes and emoji renders literally.
