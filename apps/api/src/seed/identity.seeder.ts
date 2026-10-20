/**
 * Creates the development account's identity from the reference values (`site-identity.T06`;
 * AC1, AC9). A step of `seed:all`, after the portfolio. Insert-only: an existing identity —
 * edited or not — is left as it is. Refuses in production, as every content seeder does.
 */
import { identitySchema } from '@portfolio/contracts';

import { ConflictError } from '../core/errors/index.js';
import type { IUserReader } from '../modules/auth/index.js';
import type { IIdentityRepository } from '../modules/identity/index.js';
import type { IPortfolioRepository } from '../modules/portfolio/index.js';
import { devAccountId, type ContentSeederEnv } from './portfolio.seeder.js';
import { SeedConfigurationError, SeedDataError } from './seed.errors.js';
import type { ISeeder, SeedOutcome } from './seeder.interface.js';

export class IdentitySeeder implements ISeeder {
  constructor(
    private readonly users: IUserReader,
    private readonly portfolios: IPortfolioRepository,
    private readonly identities: IIdentityRepository,
    private readonly reference: unknown,
    private readonly env: ContentSeederEnv,
  ) {}

  async run(): Promise<SeedOutcome> {
    const portfolio = await this.portfolios.findByUserId(await devAccountId(this.users, this.env));
    if (!portfolio) throw new SeedConfigurationError('OWNER_EMAIL', 'has no portfolio yet; run the portfolio seeder first');
    if (await this.identities.find(portfolio.id)) return 'unchanged';

    const parsed = identitySchema.safeParse(this.reference);
    if (!parsed.success) throw new SeedDataError('identity', 'does not satisfy its schema');
    try {
      await this.identities.create(portfolio.id, parsed.data);
      return 'created';
    } catch (error) {
      if (error instanceof ConflictError && error.code === 'IDENTITY_EXISTS') return 'unchanged';
      throw error;
    }
  }
}
