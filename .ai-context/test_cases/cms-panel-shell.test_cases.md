# Test Cases: CMS Panel Shell
**Spec:** .ai-context/specs/cms-panel-shell.spec.md
**Spec-derived unit cases:** UT01–UT07 are defined in the spec and not restated here.

## End to end (Playwright, real API + MongoDB, seeded)
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| cms-panel-shell.E2E01 | AC1 | Open `/cms/sections/about` signed out, then sign in | Redirect to login with `next`; lands on the about editor |
| cms-panel-shell.E2E02 | AC1 | Login with `?next=https://evil.example` | Lands on `/cms` |
| cms-panel-shell.E2E03 | AC2 | Wrong password | Generic inline error; field values kept except password |
| cms-panel-shell.E2E04 | AC3 | Expire the access token mid-session, then save | Save succeeds after a silent refresh |
| cms-panel-shell.E2E05 | AC5 | Edit a field and save | Save enabled only when dirty + valid; confirmation announced; reload shows the new value |
| cms-panel-shell.E2E06 | AC7 | Edit the same section in two pages; save both | Second shows the conflict dialog; "Load latest" shows the first save; "Overwrite with mine" stores the second |
| cms-panel-shell.E2E07 | AC8 | Edit, then click another nav item | Confirmation; cancel keeps edits |
| cms-panel-shell.E2E08 | AC9 | Type in a heading field | Preview text updates; toggling viewport switches frame width |
| cms-panel-shell.E2E09 | AC10 | Hide a section, reorder with keyboard controls | Overview and preview reflect both |
| cms-panel-shell.E2E10 | AC14 | Keyboard-only: sign in → open section → edit → save | Completed without a pointer; focus visible at each step |
| cms-panel-shell.E2E11 | AC14 | axe on login, overview, a section editor | No serious or critical violations |
| cms-panel-shell.E2E12 | AC12 | Inspect `/cms` response | `noindex, nofollow` present |
| cms-panel-shell.E2E13 | AC11 | Header before any publish, after a publish, and after a further edit | "Never published"; version and time; "Unpublished changes" badge |
| cms-panel-shell.E2E14 | AC3 | Sign in on context A, then on context B, then save in A | A lands on `/cms/login` with the "signed in elsewhere" notice; no refresh request |
| cms-panel-shell.E2E16 | AC21 | Signed in, open `/cms/login?next=/cms/design`, then each signed-out screen, then `/cms/login?notice=signed-out` | `/cms/design`; `/cms` for each; the sign-in form |
| cms-panel-shell.E2E15 | AC15 | Forgot password with the recorded code, a wrong code, then the right one | Inline `OTP_INVALID` message; then login screen with "password updated"; new password signs in |

## Component
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| cms-panel-shell.UT08 | AC6 | Host receives a 400 with two paths | Both fields show errors; focus on the first |
| cms-panel-shell.UT09 | Edge | A renderer throws inside the preview | Error boundary names the section; form still interactive |
| cms-panel-shell.UT10 | Edge | Save rejects with a network error | Form remains dirty; Retry shown |

## Device / viewport matrix
- CMS: 1440, 1280, 1024 (preview beside form); 768 (preview behind a toggle).
- Browsers: Chromium and WebKit in CI; Firefox before the first release.
