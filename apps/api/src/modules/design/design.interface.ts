/**
 * Contracts of the `design` module, role-sized (Interface Segregation): `ai-design` receives a
 * reader, a writer and a validator — not the whole service (`design-theme` plan).
 */
import type {
  CmsDesign,
  DesignPreset,
  DesignSpec,
  LibraryLayout,
  NewLayout,
  StoredDesign,
  StoredLayout,
  StoredPreset,
} from './design.types.js';

/** The `designs` collection; scoped by `portfolioId`. */
export interface IDesignRepository {
  find(portfolioId: string): Promise<StoredDesign | null>;
  /** @throws {ConflictError} `DESIGN_EXISTS`. */
  create(portfolioId: string, design: DesignSpec): Promise<StoredDesign>;
  /** @returns `null` when the revision did not match. */
  update(portfolioId: string, expectedRevision: number, design: DesignSpec): Promise<StoredDesign | null>;
}

/** The one verdict on a candidate design (`design-theme.AC11`). */
export interface IDesignValidator {
  /**
   * @returns The normalised design.
   * @throws {ValidationError} Every shape, catalogue and contrast problem, with paths.
   */
  validate(candidate: unknown): DesignSpec;
}

/** Reads a portfolio's design; the default when none is stored. */
export interface IDesignReader {
  read(portfolioId: string): Promise<CmsDesign>;
}

/** Writes a design after validating it exactly as API02 does. */
export interface IDesignWriter {
  /**
   * @throws {ValidationError} The design is not valid.
   * @throws {ConflictError} `REVISION_CONFLICT` with `currentRevision`.
   */
  apply(portfolioId: string, candidate: unknown, expectedRevision: number): Promise<CmsDesign>;
}

/** `design-theme.API01`–`API03`. */
export interface IDesignService extends IDesignReader, IDesignWriter {
  /** Replaces the design with the default. @throws {ConflictError} `REVISION_CONFLICT`. */
  reset(portfolioId: string, expectedRevision: number): Promise<CmsDesign>;
}

/** Finds a library layout, so a design naming `custom:<id>` can be checked (`design-library.AC2`). */
export interface ILayoutLookup {
  findLayout(portfolioId: string, layoutId: string): Promise<StoredLayout | null>;
}

/** The `design_layouts` collection; scoped by `portfolioId`. */
export interface ILayoutLibraryRepository extends ILayoutLookup {
  insertMany(portfolioId: string, layouts: readonly NewLayout[], createdAt: Date): Promise<StoredLayout[]>;
  list(portfolioId: string): Promise<StoredLayout[]>;
  count(portfolioId: string): Promise<number>;
  /** @returns `false` when it did not exist. */
  delete(portfolioId: string, layoutId: string): Promise<boolean>;
}

/** The `design_presets` collection; scoped by `portfolioId`. */
export interface IPresetRepository {
  insert(portfolioId: string, preset: { name: string; design: DesignSpec }, createdAt: Date): Promise<StoredPreset>;
  find(portfolioId: string, presetId: string): Promise<StoredPreset | null>;
  list(portfolioId: string): Promise<StoredPreset[]>;
  count(portfolioId: string): Promise<number>;
  /** @returns `false` when it did not exist. */
  delete(portfolioId: string, presetId: string): Promise<boolean>;
  /** `true` when any preset's design names `layoutRef` (`custom:<id>`) for some section. */
  usesLayout(portfolioId: string, layoutRef: string): Promise<boolean>;
}

/** Saves custom layouts to the library; `ai-design` applies proposals through it (AC8). */
export interface ILayoutLibraryWriter {
  /**
   * Validates every layout, then stores them all, or none.
   * @throws {ValidationError} A layout fails `validateCustomLayout`, with paths `layouts.<n>.…`.
   * @throws {ConflictError} `LIBRARY_FULL` with `max`.
   */
  saveLayouts(portfolioId: string, layouts: readonly { name: string; layout: unknown; source: NewLayout['source'] }[]): Promise<StoredLayout[]>;
}

/** Saves a design as a named preset; `ai-design` saves proposals through it (AC8). */
export interface IPresetWriter {
  /**
   * @throws {ValidationError} The design is not valid, or names a layout not in the library.
   * @throws {ConflictError} `LIBRARY_FULL` with `max`.
   */
  savePreset(portfolioId: string, name: string, design: unknown): Promise<DesignPreset>;
}

/** `design-library.API01`–`API06`. */
export interface IDesignLibraryService extends ILayoutLibraryWriter, IPresetWriter {
  listLayouts(portfolioId: string): Promise<LibraryLayout[]>;
  /**
   * @throws {NotFoundError}
   * @throws {ConflictError} `LAYOUT_IN_USE` with `usedBy` (AC5).
   */
  deleteLayout(portfolioId: string, layoutId: string): Promise<void>;
  listPresets(portfolioId: string): Promise<DesignPreset[]>;
  /** Saves the current draft design (API04). */
  savePresetFromDraft(portfolioId: string, name: string): Promise<DesignPreset>;
  /**
   * @throws {NotFoundError}
   * @throws {ConflictError} `REVISION_CONFLICT`.
   * @throws {ValidationError} A layout the preset names is no longer in the library.
   */
  applyPreset(portfolioId: string, presetId: string, expectedRevision: number): Promise<CmsDesign>;
  /** @throws {NotFoundError} */
  deletePreset(portfolioId: string, presetId: string): Promise<void>;
}
