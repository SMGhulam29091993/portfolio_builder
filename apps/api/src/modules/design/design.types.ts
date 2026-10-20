/**
 * Domain types of the `design` module (`design-theme` plan → Data Model). The design shape is
 * owned by `packages/design-tokens`; request envelopes by `packages/contracts`.
 */
import type { DesignSpec } from '@portfolio/design-tokens';

export { resetDesignRequestSchema, updateDesignRequestSchema, type ResetDesignRequest, type UpdateDesignRequest } from '@portfolio/contracts';
export type { DesignSpec } from '@portfolio/design-tokens';

/** One portfolio's stored design (ADR-0010: one per portfolio). */
export interface StoredDesign {
  readonly portfolioId: string;
  readonly revision: number;
  readonly design: DesignSpec;
  readonly updatedAt: Date;
}

/** The design as the CMS sees it. `revision: 0` means the default, not stored yet. */
export interface CmsDesign extends DesignSpec {
  readonly revision: number;
  readonly updatedAt?: string;
}
