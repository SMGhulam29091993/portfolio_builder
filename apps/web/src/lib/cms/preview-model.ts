/**
 * The preview model (`cms-panel-shell.AC9`, `UT06`): the saved draft with one section's unsaved
 * values applied — only that section's data replaced, everything else as saved. Pure, so the
 * rule is unit-tested; the preview renders this through `packages/sections`.
 */
import type { CmsSection, PortfolioDraftResponse } from '@portfolio/contracts';

export interface PreviewModel {
  readonly sections: readonly { type: string; visible: boolean; data: unknown }[];
  readonly sectionOrder: readonly string[];
}

export function buildPreviewModel(
  draft: PortfolioDraftResponse,
  editing?: { readonly type: string; readonly data: unknown },
): PreviewModel {
  return {
    sectionOrder: draft.portfolio.sectionOrder,
    sections: draft.sections.map((section: CmsSection) => ({
      type: section.type,
      visible: section.visible,
      data: editing?.type === section.type ? editing.data : section.data,
    })),
  };
}
