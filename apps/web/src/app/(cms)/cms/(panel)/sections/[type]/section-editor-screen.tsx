'use client';
/** Binds the editor host to the section editor registry (`cms-panel-shell.T05`). */
import { SectionEditorHost } from '../../../../../../components/cms/editor/section-editor-host';
import { sectionEditors } from '../_editors/registry';

export function SectionEditorScreen({ type }: { type: string }) {
  return <SectionEditorHost type={type} registry={sectionEditors} />;
}
