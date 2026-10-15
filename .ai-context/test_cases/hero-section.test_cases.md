# Test Cases: Hero Section
**Spec:** .ai-context/specs/hero-section.spec.md
**Spec-derived unit cases:** UT01–UT07 are defined in the spec and not restated here.

## Integration (real MongoDB, through the section engine)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| hero-section.IT01 | AC1 | Seed, then read `hero` through `section-engine.API01` | Reference content present |
| hero-section.IT02 | AC2 | PUT each invalid payload from AC2 through `section-engine.API03` | 400 with the expected path each time |
| hero-section.IT03 | AC2 | PUT a CTA targeting `hero` | 400 at `primaryCta.target` |

## End to end (Playwright)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| hero-section.E2E01 | AC7 | Activate `See my work` | Viewport at the work section; focus on its heading |
| hero-section.E2E02 | AC11 | Emulate reduced motion | Marquee has no running animation |
| hero-section.E2E03 | AC12 | Add a code-card entry as a list value in the CMS and save | Preview and reload show it |
| hero-section.E2E04 | AC9 | At 390, measure document width with a long code line | No horizontal page scroll |

## Visual (Playwright baselines, approved by the owner against `docs/design-reference/`)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| hero-section.VR01 | AC3 | Hero at 1440 with seed content | Matches approved baseline |
| hero-section.VR02 | AC3 | Hero at 390 with seed content | Matches approved baseline |
| hero-section.VR03 | Edge | Hero at 1440 with the code card disabled | Text column spans; baseline |

## Component
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| hero-section.UT08 | AC8 | Render with two identity socials, with none, and with `showSocialIcons: false` | Two icon links named by platform; no row; no row |
| hero-section.UT09 | AC10 | Render the code card with `showLocation` true / false, and with no `timezoneLabel` | `Kolkata, India · IST (UTC+5:30)`; no footer; label only, no dangling dot |

## Accessibility
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| hero-section.E2E05 | constitution | axe on the rendered section at 1440 and 390 | No serious or critical violations |

## Data variations
- Heading and name at maximum length; one CTA; no socials; marquee with 4 and 24 items; code card with 1 and 8 entries.
- Text containing `<`, `&`, quotes and emoji renders literally.
