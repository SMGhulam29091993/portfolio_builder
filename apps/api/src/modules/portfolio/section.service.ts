/**
 * `ISectionService` — the generic section engine (`section-engine.T04`; API01–API05; ADR-0005).
 *
 * Every operation acts on one portfolio, the one `resolvePortfolio` resolved for the signed-in
 * user; nothing here can reach another (`constitution.md` → Tenant isolation). Payloads are
 * validated by the registered definition's own schema — free text is cleaned by `plainText`
 * inside it — then list items get ids, then one conditional write stores the result. The
 * engine knows nothing about any section type beyond its definition (Open/Closed, AC10).
 */
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/index.js';
import type { ValidationIssue } from '../../core/errors/index.js';
import type {
  IIdGenerator,
  IPortfolioRepository,
  ISectionDefinition,
  ISectionRegistry,
  ISectionRepository,
  ISectionService,
} from './portfolio.interface.js';
import { toCmsPortfolio, toCmsSection } from './portfolio.mappers.js';
import type {
  CmsSection,
  Portfolio,
  PortfolioDraftResponse,
  SectionTypeInfo,
} from './portfolio.types.js';

export class SectionService implements ISectionService {
  constructor(
    private readonly portfolios: IPortfolioRepository,
    private readonly sections: ISectionRepository,
    private readonly registry: ISectionRegistry,
    private readonly ids: IIdGenerator,
  ) {}

  async readDraft(portfolioId: string): Promise<PortfolioDraftResponse> {
    const portfolio = await this.requirePortfolio(portfolioId);
    const stored = new Map(
      (await this.sections.listByPortfolio(portfolioId)).map((section) => [section.type, section]),
    );
    // Every registered type, in registration order. A type with no stored document shows its
    // defaults, hidden, at revision 0 (AC18). A stored type no longer registered is omitted.
    const sections = this.registry.list().map((definition) => {
      const section = stored.get(definition.type);
      return section ? toCmsSection(section) : missingSection(definition);
    });
    return { portfolio: toCmsPortfolio(portfolio), sections };
  }

  listTypes(): readonly SectionTypeInfo[] {
    return this.registry.list().map(({ type, label, orderable, hideable, inNav }) => ({
      type,
      label,
      orderable,
      hideable,
      inNav,
    }));
  }

  async updateSection(
    portfolioId: string,
    type: string,
    expectedRevision: number,
    data: unknown,
  ): Promise<CmsSection> {
    const definition = this.requireDefinition(type);
    const parsed = definition.schema.safeParse(data);
    if (!parsed.success) {
      // Paths are relative to `data`, so the editor can attach each to its field (AC4).
      throw new ValidationError(
        parsed.error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      );
    }
    const withIds = assignItemIds(parsed.data, this.ids);

    if (expectedRevision === 0) {
      // A type with no stored document yet (AC18): the first save creates it, hidden as shown.
      return this.createFirst(portfolioId, type, { data: withIds, visible: false });
    }
    const updated = await this.sections.update(portfolioId, type, expectedRevision, { data: withIds });
    if (!updated) throw await this.revisionConflict(portfolioId, type);
    return toCmsSection(updated);
  }

  async setVisibility(
    portfolioId: string,
    type: string,
    expectedRevision: number,
    visible: boolean,
  ): Promise<CmsSection> {
    const definition = this.requireDefinition(type);
    if (!definition.hideable) {
      throw new ConflictError('SECTION_NOT_HIDEABLE', {}, 'This section cannot be hidden');
    }
    if (expectedRevision === 0) {
      return this.createFirst(portfolioId, type, { data: definition.defaults(), visible });
    }
    const updated = await this.sections.update(portfolioId, type, expectedRevision, { visible });
    if (!updated) throw await this.revisionConflict(portfolioId, type);
    return toCmsSection(updated);
  }

  async reorder(
    portfolioId: string,
    expectedRevision: number,
    order: readonly string[],
  ): Promise<Portfolio> {
    const orderable = this.registry
      .list()
      .filter((definition) => definition.orderable)
      .map((definition) => definition.type);
    const issues = permutationIssues(order, orderable);
    if (issues.length > 0) throw new ValidationError(issues);

    const updated = await this.portfolios.updateOrder(portfolioId, expectedRevision, order);
    if (updated) return updated;
    const current = await this.requirePortfolio(portfolioId);
    throw conflict(current.revision);
  }

  /** Creates a section's first document; a parallel creation surfaces as a revision conflict. */
  private async createFirst(
    portfolioId: string,
    type: string,
    section: { data: unknown; visible: boolean },
  ): Promise<CmsSection> {
    try {
      return toCmsSection(await this.sections.create(portfolioId, { type, ...section }));
    } catch (error) {
      if (error instanceof ConflictError && error.code === 'SECTION_EXISTS') {
        throw await this.revisionConflict(portfolioId, type);
      }
      throw error;
    }
  }

  /** The conflict for a missed conditional write, carrying the revision now stored (AC3). */
  private async revisionConflict(portfolioId: string, type: string): Promise<ConflictError> {
    const current = await this.sections.find(portfolioId, type);
    return conflict(current?.revision ?? 0);
  }

  private requireDefinition(type: string): ISectionDefinition {
    const definition = this.registry.get(type);
    if (!definition) throw new NotFoundError('Unknown section type');
    return definition;
  }

  private async requirePortfolio(portfolioId: string): Promise<Portfolio> {
    const portfolio = await this.portfolios.findById(portfolioId);
    if (!portfolio) throw new NotFoundError('Portfolio not found');
    return portfolio;
  }
}

function conflict(currentRevision: number): ConflictError {
  return new ConflictError(
    'REVISION_CONFLICT',
    { currentRevision },
    'This was changed elsewhere. Reload to see the latest version',
  );
}

/**
 * Gives every list item without an `id` a fresh one, keeps existing ids, and refuses two items
 * sharing an id in one array (`section-engine.AC7`). A list item is any object inside an array
 * (spec → Shared payload primitives); arrays of strings are left alone.
 */
function assignItemIds(value: unknown, ids: IIdGenerator, path: (string | number)[] = []): unknown {
  if (Array.isArray(value)) {
    const seen = new Set<string>();
    return value.map((element: unknown, index) => {
      const next = assignItemIds(element, ids, [...path, index]);
      if (!isPlainObject(next)) return next;
      const id = typeof next.id === 'string' ? next.id : ids.next();
      if (seen.has(id)) {
        throw new ValidationError([
          { path: [...path, index, 'id'].join('.'), message: 'Two items share this id' },
        ]);
      }
      seen.add(id);
      return { ...next, id };
    });
  }
  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [key, assignItemIds(inner, ids, [...path, key])]),
    );
  }
  return value;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** What makes `order` not an exact permutation of `orderable` (AC9, UT08). */
function permutationIssues(order: readonly string[], orderable: readonly string[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const allowed = new Set(orderable);
  const seen = new Set<string>();
  order.forEach((type, index) => {
    if (!allowed.has(type)) issues.push({ path: `order.${String(index)}`, message: 'Not an orderable section' });
    else if (seen.has(type)) issues.push({ path: `order.${String(index)}`, message: 'Listed twice' });
    seen.add(type);
  });
  for (const type of orderable) {
    if (!seen.has(type)) issues.push({ path: 'order', message: `Missing ${type}` });
  }
  return issues;
}

function missingSection(definition: ISectionDefinition): CmsSection {
  return { type: definition.type, visible: false, revision: 0, data: definition.defaults() };
}
