# Test Cases: Design Library
**Spec:** .ai-context/specs/design-library.spec.md
| Test ID | Maps to | Scenario | Expected |
|---|---|---|---|
| design-library.UT01 | AC1 | Valid trees for every section; missing, duplicated or foreign blocks; wrong `columns` pairing; bad style; too many children | Accepted; each refused with a path |
| design-library.UT02 | AC1 | `validateDesign` with `custom:<id>` entries and malformed ones | Shape accepted; malformed refused |
| design-library.UT04 | AC7 | The answer schema per scope with and without explore, and exploring each section alone | No `customLayouts` without explore or for `theme`; a tree per visible section under explore; base and one-tree schemas within the Gemini-accepted size |
| design-library.UT03 | AC3 | `CustomLayoutRenderer` for each section | Every block drawn once, in order, columns classes as given |
| design-library.IT01 | AC2 | Save a design naming a library layout; another section's; another portfolio's; unknown | 200; 400; 400; 400 |
| design-library.IT02 | AC5 | Delete a layout used by the draft; by a preset; unused | 409 `LAYOUT_IN_USE` (usedBy); 409; 200 |
| design-library.IT03 | AC6 | Save, list, apply (current / stale revision), delete a preset; the 21st preset | 201, listed, 200 / 409, 200; 409 `LIBRARY_FULL` |
| design-library.IT04 | AC4 | Publish with a custom layout, delete it from the library | Snapshot v2 holds the copy; public API still serves it |
| design-library.IT05 | AC7, AC8 | Stub/scripted proposal with custom layouts, `explore: true`; apply; save as preset | Prompt asks for new layouts; layouts saved; design names them; preset saved |
| design-library.E2E01 | AC9 | Explore, preview, apply; the layout appears under the section's layout choice | Preview and Design screen show it |
| design-library.E2E02 | AC9 | Save current design as a preset, change it, apply the preset | Design returns to the preset |
