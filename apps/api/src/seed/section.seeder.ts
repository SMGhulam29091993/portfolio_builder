/**
 * Creates the development account's sections (`section-engine.T06`; AC12): the owner's
 * reference content from `seed/data/sections/` for every type that has an entry, the template
 * defaults for every other registered type. Insert-only (`createMissing`), so a re-run — or a
 * run after the owner edited a section in the CMS — creates and overwrites nothing.
 *
 * Seed data is validated against each type's schema before anything is written, and every list
 * item must carry its fixed id; a violation is a `SeedDataError` naming the type.
 */
import type { IUserReader } from '../modules/auth/index.js';
import type {
  IPortfolioRepository,
  ISectionRegistry,
  ISectionRepository,
  NewSection,
} from '../modules/portfolio/index.js';
import { devAccountId, type ContentSeederEnv } from './portfolio.seeder.js';
import { SeedConfigurationError, SeedDataError } from './seed.errors.js';
import type { ISeeder, SeedOutcome } from './seeder.interface.js';

export class SectionSeeder implements ISeeder {
  constructor(
    private readonly users: IUserReader,
    private readonly portfolios: IPortfolioRepository,
    private readonly sections: ISectionRepository,
    private readonly registry: ISectionRegistry,
    private readonly referenceContent: Readonly<Record<string, unknown>>,
    private readonly env: ContentSeederEnv,
  ) {}

  async run(): Promise<SeedOutcome> {
    const userId = await devAccountId(this.users, this.env);
    const portfolio = await this.portfolios.findByUserId(userId);
    if (!portfolio) {
      throw new SeedConfigurationError('OWNER_EMAIL', 'has no portfolio yet; run the portfolio seeder first');
    }

    // Validate everything first, so a bad entry writes nothing at all.
    const planned: NewSection[] = this.registry.list().map((definition) => {
      const reference = this.referenceContent[definition.type];
      if (reference === undefined) {
        return { type: definition.type, visible: true, data: definition.defaults() };
      }
      const parsed = definition.schema.safeParse(reference);
      if (!parsed.success) throw new SeedDataError(definition.type, 'does not satisfy its schema');
      if (hasItemWithoutId(parsed.data)) {
        throw new SeedDataError(definition.type, 'has a list item without a fixed id');
      }
      return { type: definition.type, visible: true, data: parsed.data };
    });

    const created = await this.sections.createMissing(portfolio.id, planned);
    return created > 0 ? 'created' : 'unchanged';
  }
}

/** `true` when some object inside an array has no string `id` (spec → Shared payload primitives). */
function hasItemWithoutId(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(
      (element: unknown) =>
        (typeof element === 'object' &&
          element !== null &&
          !Array.isArray(element) &&
          typeof (element as { id?: unknown }).id !== 'string') ||
        hasItemWithoutId(element),
    );
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(hasItemWithoutId);
  }
  return false;
}
