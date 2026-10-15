# Test Cases: Contact Section
**Spec:** .ai-context/specs/contact-section.spec.md
**Spec-derived unit cases:** UT01–UT06 are defined in the spec and not restated here.

## Integration (real MongoDB, through the section engine)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| contact-section.IT01 | AC1 | Seed, then read `contact` | Reference content present |
| contact-section.IT02 | AC2 | PUT each invalid payload from AC2 | 400 with the expected path each time |

## End to end (Playwright)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| contact-section.E2E01 | AC6 | Activate the copy chip with clipboard permission granted | Clipboard holds the full address; "Copied" announced |
| contact-section.E2E02 | AC6 | Activate the copy chip with the clipboard API removed | Address selected; no page error |
| contact-section.E2E03 | AC5 | Inspect the email button | `href` starts with `mailto:` and the identity email |
| contact-section.E2E04 | AC9 | Open the contact editor | Email shown read-only with a link to Identity |

## Visual (Playwright baselines, approved by the owner against `docs/design-reference/`)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| contact-section.VR01 | AC3, AC4 | Contact at 1440 with seed content | Matches approved baseline |
| contact-section.VR02 | AC7 | Contact at 390 with seed content | Address truncated; baseline |
| contact-section.VR03 | Edge | Contact at 1440 with the copy chip off | Single centred button; baseline |

## Accessibility
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| contact-section.E2E05 | constitution | axe on the rendered section at 1440 and 390 | No serious or critical violations |

## Data variations
- No body; long email (254 characters); zero and four socials; subject with reserved characters.
- Text containing `<`, `&`, quotes and emoji renders literally.
