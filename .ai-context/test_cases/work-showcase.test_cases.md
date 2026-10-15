# Test Cases: Work Showcase
**Spec:** .ai-context/specs/work-showcase.spec.md
**Spec-derived unit cases:** UT01–UT07 are defined in the spec and not restated here.

## Integration (real MongoDB, through the section engine)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| work-showcase.IT01 | AC1 | Seed, then read `work` | Four projects; Second Brain description contains the bracketed placeholder |
| work-showcase.IT02 | AC2 | PUT each invalid payload from AC2 | 400 with the expected path each time |
| work-showcase.IT03 | AC2 | PUT two featured projects | 400 naming the second |

## End to end (Playwright)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| work-showcase.E2E01 | AC10 | Feature a different project in the CMS | Previous one un-featured; preview swaps cards |
| work-showcase.E2E02 | AC5 | Inspect the Second Brain arrow link | `target=_blank`, `rel` set, name includes the title |
| work-showcase.E2E03 | Edge | Try to un-feature a project with four metrics | Blocked with an explanation |

## Visual (Playwright baselines, approved by the owner against `docs/design-reference/`)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| work-showcase.VR01 | AC3, AC4 | Work at 1440 with seed content | Matches approved baseline |
| work-showcase.VR02 | AC3 | Work at 390 with seed content | Matches approved baseline |
| work-showcase.VR03 | AC6 | Work at 1440 with no featured project | Grid only; baseline |
| work-showcase.VR04 | AC7 | Work at 1440 with five grid projects | Second row left-aligned; baseline |

## Component
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| work-showcase.UT08 | AC9 | Inspect rendered markup | Project titles are `h3` under one `h2`; metric values carry the accent token class, labels the muted one |

## Accessibility
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| work-showcase.E2E04 | constitution | axe on the rendered section at 1440 and 390 | No serious or critical violations |

## Data variations
- 1 and 9 projects; descriptions at 400 characters; 0 and 10 tags; featured with 0 and 4 metrics.
- Text containing `<`, `&`, quotes and emoji renders literally.
