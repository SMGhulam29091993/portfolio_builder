/**
 * Contracts of the `portfolio` module, owned on the consuming side and role-sized
 * (`constitution.md` → SOLID). Persistence ports from `section-engine.T02`; registry and id
 * ports from `T03`; service ports from `T04`; HTTP ports from `T05`.
 */
import type { ZodType } from 'zod';

import type {
  CmsSection,
  NewPortfolio,
  NewSection,
  Portfolio,
  PortfolioDraftResponse,
  SectionChanges,
  SectionTypeInfo,
  StoredSection,
} from './portfolio.types.js';

/** The `portfolios` collection. */
export interface IPortfolioRepository {
  findByUserId(userId: string): Promise<Portfolio | null>;
  findById(id: string): Promise<Portfolio | null>;
  findBySlug(slug: string): Promise<Portfolio | null>;
  /**
   * @throws {ConflictError} `PORTFOLIO_EXISTS` — this user already has one (a provisioning
   *   race); `SLUG_TAKEN` — another portfolio holds the slug.
   */
  create(portfolio: NewPortfolio): Promise<Portfolio>;
  /**
   * Replaces `sectionOrder` while the revision equals `expectedRevision`, incrementing it.
   *
   * @returns The updated portfolio, or `null` when the revision did not match.
   */
  updateOrder(id: string, expectedRevision: number, order: readonly string[]): Promise<Portfolio | null>;
  /**
   * Replaces the slug while the revision equals `expectedRevision`, incrementing it.
   *
   * @returns The updated portfolio, or `null` when the revision did not match.
   * @throws {ConflictError} `SLUG_TAKEN` — another portfolio holds the slug.
   */
  updateSlug(id: string, expectedRevision: number, slug: string): Promise<Portfolio | null>;
}

/** The `sections` collection. Every method is scoped by `portfolioId` (tenant isolation). */
export interface ISectionRepository {
  listByPortfolio(portfolioId: string): Promise<StoredSection[]>;
  find(portfolioId: string, type: string): Promise<StoredSection | null>;
  /**
   * Creates the section at revision 1.
   *
   * @throws {ConflictError} `SECTION_EXISTS` — the type already has a document here.
   */
  create(portfolioId: string, section: NewSection): Promise<StoredSection>;
  /**
   * Creates every section that does not exist yet and leaves existing ones untouched — the
   * idempotent half of provisioning and seeding.
   *
   * @returns How many were created.
   */
  createMissing(portfolioId: string, sections: readonly NewSection[]): Promise<number>;
  /**
   * Applies `changes` while the revision equals `expectedRevision`, incrementing it.
   *
   * @returns The updated section, or `null` when it is missing or the revision did not match.
   */
  update(
    portfolioId: string,
    type: string,
    expectedRevision: number,
    changes: SectionChanges,
  ): Promise<StoredSection | null>;
}

/**
 * One section type (ADR-0005; `section-engine` plan → Architecture Approach). Each section spec
 * adds one class implementing this and one line in the container's definition list; the engine
 * never changes (Open/Closed, `section-engine.AC10`).
 */
export interface ISectionDefinition<T = unknown> {
  /** Lower-case id used in routes and storage, e.g. `about`. */
  readonly type: string;
  /** Shown in the CMS. */
  readonly label: string;
  /** `false` only for `hero`, which is always first. */
  readonly orderable: boolean;
  /** `false` only for `hero`. */
  readonly hideable: boolean;
  /** Whether the section has a nav entry. */
  readonly inNav: boolean;
  /** The payload schema, from `packages/contracts`. Every object in an array is a `listItem`. */
  readonly schema: ZodType<T>;
  /**
   * The reference template's content for a new portfolio: the reference design's structure with
   * bracketed placeholder text (`section-engine` → Portfolio provisioning). Must satisfy
   * `schema` — checked when the registry is built.
   */
  defaults(): T;
}

/** The registered section types (Strategy + Registry). */
export interface ISectionRegistry {
  /** The definition of `type`, or `undefined` when it is not registered. */
  get(type: string): ISectionDefinition | undefined;
  /** Every definition, in registration order. */
  list(): readonly ISectionDefinition[];
}

/** Stable ids for list items. */
export interface IIdGenerator {
  /** A fresh URL-safe id, unique with overwhelming probability. */
  next(): string;
}

/**
 * A user's display name, read from `auth` for the initial slug. The container adapts `auth`'s
 * user reader to it, so `portfolio` imports nothing from `auth` for this.
 */
export interface IUserDirectory {
  displayNameOf(userId: string): Promise<string | null>;
}

/** Gets or creates a user's portfolio (`section-engine` → Portfolio provisioning). */
export interface IPortfolioProvisioner {
  /** The user's portfolio, provisioned from the template on first use (`section-engine.AC15`). */
  resolveFor(userId: string): Promise<Portfolio>;
  /**
   * @throws {ConflictError} `SLUG_TAKEN` (reserved or used) or `REVISION_CONFLICT`.
   */
  changeSlug(portfolioId: string, expectedRevision: number, slug: string): Promise<Portfolio>;
}

/** The section engine's operations (`section-engine.API01`–`API05`), on one portfolio. */
export interface ISectionService {
  readDraft(portfolioId: string): Promise<PortfolioDraftResponse>;
  listTypes(): readonly SectionTypeInfo[];
  /**
   * @throws {NotFoundError} The type is not registered.
   * @throws {ValidationError} `data` fails the type's schema, or a list has duplicate ids.
   * @throws {ConflictError} `REVISION_CONFLICT` with `currentRevision`.
   */
  updateSection(portfolioId: string, type: string, expectedRevision: number, data: unknown): Promise<CmsSection>;
  /**
   * @throws {NotFoundError} The type is not registered.
   * @throws {ConflictError} `SECTION_NOT_HIDEABLE`, or `REVISION_CONFLICT`.
   */
  setVisibility(portfolioId: string, type: string, expectedRevision: number, visible: boolean): Promise<CmsSection>;
  /**
   * @throws {ValidationError} `order` is not a permutation of the orderable types.
   * @throws {ConflictError} `REVISION_CONFLICT`.
   */
  reorder(portfolioId: string, expectedRevision: number, order: readonly string[]): Promise<Portfolio>;
}
