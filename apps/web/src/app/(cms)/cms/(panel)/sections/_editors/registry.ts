/**
 * The section editor registry (`cms-panel-shell.T05`; `int-standards.nextjs.md` → Adding a
 * section type: step 3). Strategy + Registry, mirroring the API's `SectionRegistry`: each
 * section spec adds one entry — its contract schema and its editor component — and the
 * editor host is never edited. A type with no entry shows "No editor is available".
 */
import type { SectionEditorEntry } from '../../../../../../components/cms/editor/editor-registry';
import { createEditorRegistry } from '../../../../../../components/cms/editor/editor-registry';
import { aboutEditor } from './about';
import { contactEditor } from './contact';
import { experienceEditor } from './experience';
import { heroEditor } from './hero';
import { stackEditor } from './stack';
import { workEditor } from './work';

/** Every section editor, by type. */
export const SECTION_EDITORS: readonly SectionEditorEntry[] = [heroEditor, aboutEditor, workEditor, experienceEditor, stackEditor, contactEditor];

export const sectionEditors = createEditorRegistry(SECTION_EDITORS);
