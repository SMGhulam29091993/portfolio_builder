/**
 * Domain types of the `portfolio` module (`section-engine` plan → Data Model). Request and
 * response payloads are owned by `packages/contracts` and re-exported here
 * (`int-standards.express.md` → Input validation).
 */
export {
  changeSlugRequestSchema,
  RESERVED_SLUGS,
  reorderSectionsRequestSchema,
  sectionParamsSchema,
  setVisibilityRequestSchema,
  slugSchema,
  updateSectionRequestSchema,
  type ChangeSlugRequest,
  type CmsPortfolio,
  type CmsSection,
  type PortfolioDraftResponse,
  type ReorderSectionsRequest,
  type SectionTypeInfo,
  type SetVisibilityRequest,
  type UpdateSectionRequest,
} from '@portfolio/contracts';

/** A user's portfolio (one per user, ADR-0010). The tenant boundary of every content document. */
export interface Portfolio {
  readonly id: string;
  /** The owning `users` id; unique. */
  readonly userId: string;
  /** Unique; the free portfolio's path on the platform domain (`<platform>/<slug>`). */
  readonly slug: string;
  /** Orderable section types, in page order; `hero` is never listed (always first). */
  readonly sectionOrder: readonly string[];
  readonly revision: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What creating a portfolio needs. Starts at revision 1. */
export interface NewPortfolio {
  readonly userId: string;
  readonly slug: string;
  readonly sectionOrder: readonly string[];
}

/** One stored section of one portfolio. */
export interface StoredSection {
  readonly id: string;
  readonly portfolioId: string;
  readonly type: string;
  readonly visible: boolean;
  readonly revision: number;
  /** Validated against the type's schema before it is stored; opaque to the engine. */
  readonly data: unknown;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** What creating a section needs. Starts at revision 1. */
export interface NewSection {
  readonly type: string;
  readonly visible: boolean;
  readonly data: unknown;
}

/** The fields a conditional section update may change. */
export interface SectionChanges {
  readonly data?: unknown;
  readonly visible?: boolean;
}

/** The portfolio a `/cms` request acts on, as `resolvePortfolio` sets it on `req.portfolio`. */
export interface PortfolioContext {
  readonly portfolioId: string;
}

declare global {
  // Express exposes its request type through this global namespace; augmenting it is the
  // documented way to add a field. Declared in the module that sets it. Other `/cms` modules
  // read `req.portfolio` through this global declaration without importing `portfolio`, which
  // keeps the module graph acyclic (ADR-0013).
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `resolvePortfolio` only, after `requireOwner`. */
      portfolio?: PortfolioContext;
    }
  }
}
