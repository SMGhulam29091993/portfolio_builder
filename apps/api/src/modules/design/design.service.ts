/**
 * `IDesignService` — one portfolio's design (`design-theme.T03`; API01–API03; ADR-0010). With
 * nothing stored, the design is `DEFAULT_DESIGN` (the reference) at revision 0, and the first
 * write creates it. Every write — API02, a reset, an AI proposal through `IDesignWriter` — goes
 * through the same validator.
 */
import { DEFAULT_DESIGN } from '@portfolio/design-tokens';

import { ConflictError } from '../../core/errors/index.js';
import type { IDesignRepository, IDesignService, IDesignValidator } from './design.interface.js';
import type { CmsDesign, DesignSpec, StoredDesign } from './design.types.js';

export class DesignService implements IDesignService {
  constructor(
    private readonly designs: IDesignRepository,
    private readonly validator: IDesignValidator,
  ) {
    // A default that fails its own validator is a build defect: fail startup, not a request.
    validator.validate(DEFAULT_DESIGN);
  }

  async read(portfolioId: string): Promise<CmsDesign> {
    const stored = await this.designs.find(portfolioId);
    return stored ? toCms(stored) : { ...DEFAULT_DESIGN, revision: 0 };
  }

  async apply(portfolioId: string, candidate: unknown, expectedRevision: number): Promise<CmsDesign> {
    return this.write(portfolioId, this.validator.validate(candidate), expectedRevision);
  }

  async reset(portfolioId: string, expectedRevision: number): Promise<CmsDesign> {
    return this.write(portfolioId, DEFAULT_DESIGN, expectedRevision);
  }

  private async write(portfolioId: string, design: DesignSpec, expectedRevision: number): Promise<CmsDesign> {
    if (expectedRevision === 0) {
      try {
        return toCms(await this.designs.create(portfolioId, design));
      } catch (error) {
        if (error instanceof ConflictError && error.code === 'DESIGN_EXISTS') throw await this.conflict(portfolioId);
        throw error;
      }
    }
    const updated = await this.designs.update(portfolioId, expectedRevision, design);
    if (!updated) throw await this.conflict(portfolioId);
    return toCms(updated);
  }

  private async conflict(portfolioId: string): Promise<ConflictError> {
    const current = await this.designs.find(portfolioId);
    return new ConflictError(
      'REVISION_CONFLICT',
      { currentRevision: current?.revision ?? 0 },
      'This was changed elsewhere. Reload to see the latest version',
    );
  }
}

function toCms(stored: StoredDesign): CmsDesign {
  return { ...stored.design, revision: stored.revision, updatedAt: stored.updatedAt.toISOString() };
}
