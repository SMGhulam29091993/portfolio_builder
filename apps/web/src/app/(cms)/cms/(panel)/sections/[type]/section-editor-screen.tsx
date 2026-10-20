'use client';
/**
 * Binds the editor host to the section editor registry (`cms-panel-shell.T05`) and puts the
 * live preview beside the form (`T07`).
 */
import { SectionEditorHost } from '../../../../../../components/cms/editor/section-editor-host';
import { PreviewPane } from '../../../../../../components/cms/preview/preview-pane';
import { sectionEditors } from '../_editors/registry';

export function SectionEditorScreen({ type }: { type: string }) {
  return (
    <SectionEditorHost
      type={type}
      registry={sectionEditors}
      aside={(editing) => <PreviewPane editing={editing} />}
    />
  );
}
