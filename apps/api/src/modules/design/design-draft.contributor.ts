/**
 * Contributes the design to a publish (`publish-pipeline.T02`). Implements `IDraftContributor`
 * owned by `publishing` (ADR-0013): the stored design, or the default before the first save.
 * Read-only.
 */
import type { DesignDraft, DraftScope, IDraftContributor } from '../publishing/index.js';
import type { IDesignReader } from './design.interface.js';

export class DesignDraftContributor implements IDraftContributor<'design'> {
  readonly key = 'design' as const;

  constructor(private readonly designs: IDesignReader) {}

  async collect({ portfolioId }: DraftScope): Promise<DesignDraft> {
    const { theme, layout } = await this.designs.read(portfolioId);
    return { theme, layout };
  }
}
