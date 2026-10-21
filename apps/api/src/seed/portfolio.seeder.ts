/**
 * Creates the development account's portfolio (`section-engine.T06`; AC12). Development only:
 * it seeds the account `OwnerSeeder` creates and refuses in production, as that seeder does
 * (ADR-0010).
 *
 * Idempotent: an existing portfolio is left exactly as it is, slug and order included.
 */
import type { Env } from '../config/env.js';
import type { IUserReader } from '../modules/auth/index.js';
import type { IPortfolioRepository, ISectionRegistry } from '../modules/portfolio/index.js';
import { DEV_PORTFOLIO } from './data/portfolio.js';
import { SeedConfigurationError, SeedRefusedError } from './seed.errors.js';
import type { ISeeder, SeedOutcome } from './seeder.interface.js';

/** The configuration the portfolio and section seeders read. */
export type ContentSeederEnv = Pick<Env, 'NODE_ENV' | 'OWNER_EMAIL'>;

export class PortfolioSeeder implements ISeeder {
  constructor(
    private readonly users: IUserReader,
    private readonly portfolios: IPortfolioRepository,
    private readonly registry: ISectionRegistry,
    private readonly env: ContentSeederEnv,
  ) {}

  async run(): Promise<SeedOutcome> {
    const userId = await devAccountId(this.users, this.env);
    if (await this.portfolios.findByUserId(userId)) return 'unchanged';

    try {
      await this.portfolios.create({
        userId,
        slug: DEV_PORTFOLIO.slug,
        sectionOrder: this.registry
          .list()
          .filter((definition) => definition.orderable)
          .map((definition) => definition.type),
      });
      return 'created';
    } catch (error) {
      // A concurrent run, or the account's first CMS request, created it first.
      if (await this.portfolios.findByUserId(userId)) return 'unchanged';
      throw error;
    }
  }
}

/**
 * The development account's id: refuses in production first, then requires `OWNER_EMAIL` and
 * the account `OwnerSeeder` creates from it.
 */
export async function devAccountId(users: IUserReader, env: ContentSeederEnv): Promise<string> {
  if (env.NODE_ENV === 'production') {
    throw new SeedRefusedError('The development content seeders never run with NODE_ENV=production');
  }
  if (!env.OWNER_EMAIL) throw new SeedConfigurationError('OWNER_EMAIL', 'is not set');
  const user = await users.findByEmail(env.OWNER_EMAIL);
  if (!user) throw new SeedConfigurationError('OWNER_EMAIL', 'has no account yet; run the owner seeder first');
  return user.id;
}
