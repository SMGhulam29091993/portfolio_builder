# Test Cases: Public Site Rendering
**Spec:** .ai-context/specs/public-site-rendering.spec.md
**Spec-derived unit cases:** UT01–UT08 are defined in the spec and not restated here.

## Integration (real MongoDB, real HTTP)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| public-site-rendering.IT01 | AC12 | API01 before any publish | 404 `NOT_FOUND` |
| public-site-rendering.IT02 | AC12 | Publish, then API01 | 200; ETag equals the snapshot hash |
| public-site-rendering.IT03 | AC12 | API01 with `If-None-Match` | 304, empty body |
| public-site-rendering.IT04 | AC12 | Publish, edit the draft, API01 | Still the published content |
| public-site-rendering.IT05 | AC13 | Upload an asset without publishing; request API02 | 404 |
| public-site-rendering.IT06 | AC13 | Publish with a résumé; request API02 | 200; headers as specified; bytes match |
| public-site-rendering.IT07 | AC13 | API02 with the right id and a different filename | 404 |
| public-site-rendering.IT08 | AC13 | Publish without the résumé; request the old URL | 404 |
| public-site-rendering.IT09 | AC12 | Architecture test: `public-site` importing a draft interface (fixture) | Fails |
| public-site-rendering.IT10 | Edge | Exceed the public rate limit | 429 with `Retry-After` |

## End to end (Playwright)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| public-site-rendering.E2E01 | AC1 | Publish in the CMS, open `/` | All visible sections, in order |
| public-site-rendering.E2E02 | AC2 | Fresh database, open `/` | 404 status; not-published page; `noindex` |
| public-site-rendering.E2E03 | AC11 | Publish a heading change, reload `/` | New heading shown without waiting for the fallback |
| public-site-rendering.E2E04 | AC3, AC4 | Nav at 1440 and at 390 | Full pill / monogram + résumé only |
| public-site-rendering.E2E05 | AC6 | Click each nav link | Section in view; focus on its heading; hash updated |
| public-site-rendering.E2E06 | AC6 | Press Tab once on load | Focus on "Skip to content" |
| public-site-rendering.E2E07 | AC5 | Activate the résumé pill | New tab; PDF response from API02 |
| public-site-rendering.E2E08 | AC8, AC9 | Inspect head, `/robots.txt`, `/sitemap.xml` | Tags present; `/cms` disallowed; one URL |
| public-site-rendering.E2E09 | AC15 | Measure `scrollWidth` at four widths | Equal to viewport width each time |
| public-site-rendering.E2E10 | AC18 | JavaScript disabled | Content and anchors present; mail link works |
| public-site-rendering.E2E11 | AC19 | axe at 1440 and 390; landmark and heading audit | No serious or critical violations; one `h1` |
| public-site-rendering.E2E12 | AC17 | Stop the API after a successful render, reload | Stale page served |
| public-site-rendering.E2E13 | Edge | Hide `contact`, fix the hero CTA, publish | No filled pill; no broken anchor |
| public-site-rendering.E2E14 | AC10 | Fetch `/` as raw HTML (no script execution) | The published theme's CSS variables and font classes are present in the server response |

## Visual (Playwright full-page baselines)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| public-site-rendering.VR01 | AC14 | Full page at 1440 | Owner-approved against `desktop-1440.jpg`; later runs within 1% |
| public-site-rendering.VR02 | AC14 | Full page at 390 | Owner-approved against `mobile-390.jpg`; later runs within 1% |
| public-site-rendering.VR03 | AC15 | Full page at 768 and 1024 | Baselines recorded; no overlap or clipping |

## Device / browser matrix
- Chromium and WebKit in CI at 390, 768, 1024, 1440; Firefox before the first release.
- Reduced-motion emulation on E2E01 and VR01.
- Baselines are generated with animations disabled and fonts fully loaded.
