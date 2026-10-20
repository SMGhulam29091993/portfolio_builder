/**
 * Contracts of the `design` module, role-sized (Interface Segregation): `ai-design` receives a
 * reader, a writer and a validator — not the whole service (`design-theme` plan).
 */
import type { CmsDesign, DesignSpec, StoredDesign } from './design.types.js';

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
