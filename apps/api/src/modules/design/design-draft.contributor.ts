/**
 * Contributes the design to a publish (`publish-pipeline.T02`). Implements `IDraftContributor`
 * owned by `publishing` (ADR-0013): the stored design, or the default before the first save, with
 * a copy of every library layout it names (`design-library.AC4`), so the snapshot never depends on
 * the library. Read-only.
 */
import { customLayoutId } from '@portfolio/design-tokens';

import type { DesignDraft, DraftScope, IDraftContributor } from '../publishing/index.js';
import type { IDesignReader, ILayoutLookup } from './design.interface.js';

export class DesignDraftContributor implements IDraftContributor<'design'> {
  readonly key = 'design' as const;

  constructor(
    private readonly designs: IDesignReader,
    private readonly layouts: ILayoutLookup,
  ) {}

  async collect({ portfolioId }: DraftScope): Promise<DesignDraft> {
    const { theme, layout } = await this.designs.read(portfolioId);
    const customLayouts: Record<string, unknown> = {};
    for (const [section, entry] of Object.entries(layout)) {
      const id = customLayoutId(entry);
      if (id === undefined) continue;
      // Saves check every reference, so a miss means a layout deleted under a racing save; the
      // site then falls back to the reference variant for that section.
      const found = await this.layouts.findLayout(portfolioId, id);
      if (found?.section === section) customLayouts[section] = found.layout;
    }
    return Object.keys(customLayouts).length > 0 ? { theme, layout, customLayouts } : { theme, layout };
  }
}
