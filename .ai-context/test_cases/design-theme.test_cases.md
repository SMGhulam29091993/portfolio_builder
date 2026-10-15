# Test Cases: Design Theme
**Spec:** .ai-context/specs/design-theme.spec.md
**Spec-derived unit cases:** UT01–UT08 are defined in the spec and not restated here.

## Integration (real MongoDB, real HTTP)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| design-theme.IT01 | AC1 | GET after seeding | Default design + catalogue with six sections |
| design-theme.IT02 | AC2, AC5 | PUT valid; PUT again with the old revision | 200; 409 |
| design-theme.IT03 | AC3 | PUT with four invalid values | One 400, four paths; DB unchanged |
| design-theme.IT04 | AC4 | PUT with `text` ≈ `background` | 400; message contains the ratio and `4.5` |
| design-theme.IT05 | AC6 | Edit then reset | DB equals `DEFAULT_DESIGN` |
| design-theme.IT06 | Auth | Each route with no cookie | 401 |

## Contract suites
| Test ID | Interface | Asserts |
|---|---|---|
| design-theme.CT01 | `IDesignValidator` vs API02 | For a table of 20 designs (valid and each invalid kind), the validator's verdict equals the HTTP outcome — AC11 |

## Component and visual
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| design-theme.UT09 | AC9 | Render with `motion: "none"`; render with reduced-motion preference | No motion props applied |
| design-theme.UT10 | AC8 | Lint fixture with `#c0f83c` inside a section component | Lint fails |
| design-theme.E2E01 | AC10 | Lower the text colour's contrast in the CMS | Badge fails; Save disabled; restoring enables it |
| design-theme.E2E02 | AC10 | Change accent, save, reload | Preview and stored design show the new accent |
| design-theme.VR01 | AC7 | Preview with a second, valid test theme | Layout unchanged; only token-driven properties differ |

## Data variations
- Contrast boundaries: ratios of 4.49, 4.50, 4.51 for each 4.5 pair; 2.99, 3.00 for the accent pair.
- Each `radius` value and each `motion` value.
