/**
 * Domain types of the `design` module (`design-theme` plan → Data Model). The design shape is
 * owned by `packages/design-tokens`; request envelopes by `packages/contracts`.
 */
import type { CustomLayout, DesignSpec } from '@portfolio/design-tokens';
import type { LibraryLayoutSource } from '@portfolio/contracts';

export {
  applyPresetRequestSchema,
  LAYOUT_LIBRARY_MAX,
  libraryIdParamsSchema,
  PRESET_LIBRARY_MAX,
  resetDesignRequestSchema,
  savePresetRequestSchema,
  updateDesignRequestSchema,
  type ApplyPresetRequest,
  type DesignPreset,
  type LibraryLayout,
  type LibraryLayoutSource,
  type ResetDesignRequest,
  type SavePresetRequest,
  type UpdateDesignRequest,
} from '@portfolio/contracts';
export type { CustomLayout, DesignSpec } from '@portfolio/design-tokens';

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

/** A custom layout in a portfolio's library (`design-library` → Data). */
export interface StoredLayout {
  readonly id: string;
  readonly portfolioId: string;
  readonly section: CustomLayout['section'];
  readonly name: string;
  readonly layout: CustomLayout;
  readonly source: LibraryLayoutSource;
  readonly createdAt: Date;
}

/** What saving a library layout needs; the layout is validated before it is stored. */
export interface NewLayout {
  readonly name: string;
  readonly layout: CustomLayout;
  readonly source: LibraryLayoutSource;
}

/** A named design preset (`design-library` → Data). */
export interface StoredPreset {
  readonly id: string;
  readonly portfolioId: string;
  readonly name: string;
  readonly design: DesignSpec;
  readonly createdAt: Date;
}
