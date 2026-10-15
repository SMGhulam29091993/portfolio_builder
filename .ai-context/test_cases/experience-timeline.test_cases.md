# Test Cases: Experience Timeline
**Spec:** .ai-context/specs/experience-timeline.spec.md
**Spec-derived unit cases:** UT01–UT07 are defined in the spec and not restated here.

## Integration (real MongoDB, through the section engine)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| experience-timeline.IT01 | AC1 | Seed, then read `experience` | Two roles with their highlights |
| experience-timeline.IT02 | AC2 | PUT each invalid payload from AC2 | 400 with the expected path each time |
| experience-timeline.IT03 | AC3 | PUT entries oldest-first, then read | Stored order unchanged (sorting is render-side) |

## End to end (Playwright)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| experience-timeline.E2E01 | AC8 | Add an older role at the top of the list in the CMS | Preview places it last |
| experience-timeline.E2E02 | AC8 | Toggle "Current role" | End date cleared; preview shows the present label |

## Visual (Playwright baselines, approved by the owner against `docs/design-reference/`)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| experience-timeline.VR01 | AC5 | Experience at 1440 with seed content | Matches approved baseline |
| experience-timeline.VR02 | AC5 | Experience at 390 with seed content | Matches approved baseline |
| experience-timeline.VR03 | Edge | Experience at 1440 with a single entry | No dangling line; baseline |

## Accessibility
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| experience-timeline.E2E03 | constitution | axe on the rendered section at 1440 and 390 | No serious or critical violations |

## Data variations
- 1 and 12 entries; two current roles; same-month role; missing location; highlights at 220 characters.
- Text containing `<`, `&`, quotes and emoji renders literally.
