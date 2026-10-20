/**
 * `PortfolioSeeder`, `SectionSeeder` and `SeedAll` with fakes and test-only definitions
 * (`section-engine.T06`; AC12, `section-engine.IT11`).
 */
import { describe, expect, it } from 'vitest';

import {
  FakeHeroDefinition,
  FakeSectionDefinition,
  FakePasswordHasher,
  InMemoryPortfolioRepository,
  InMemorySectionRepository,
  InMemoryUserRepository,
  ManualClock,
} from '../testing/index.js';
import type { ISectionDefinition, ISectionRegistry } from '../modules/portfolio/index.js';
import { OwnerSeeder } from './owner.seeder.js';
import { PortfolioSeeder, type ContentSeederEnv } from './portfolio.seeder.js';
import { SeedAll } from './seed-all.seeder.js';
import { SeedConfigurationError, SeedDataError, SeedRefusedError } from './seed.errors.js';
import { SectionSeeder } from './section.seeder.js';

const ENV = { NODE_ENV: 'development', OWNER_EMAIL: 'dev@example.test', OWNER_PASSWORD: 'a dev password value' } as const;
/** A registry over `definitions` — the seeders only read it. */
function registryOf(definitions: readonly ISectionDefinition[]): ISectionRegistry {
  return { get: (type) => definitions.find((d) => d.type === type), list: () => definitions };
}

const REFERENCE = {
  about: { heading: 'Production backends', items: [{ id: 'fixed-1', title: 'One' }], tags: ['ts'] },
};

function build(reference: Readonly<Record<string, unknown>> = REFERENCE, env: ContentSeederEnv = ENV) {
  const users = new InMemoryUserRepository();
  const portfolios = new InMemoryPortfolioRepository();
  const sections = new InMemorySectionRepository();
  const registry = registryOf([new FakeHeroDefinition(), new FakeSectionDefinition('about'), new FakeSectionDefinition('work')]);
  const owner = new OwnerSeeder(users, users, new FakePasswordHasher(), ENV, users, users, new ManualClock());
  const all = new SeedAll([
    { name: 'owner', seeder: owner },
    { name: 'portfolio', seeder: new PortfolioSeeder(users, portfolios, registry, env) },
    { name: 'sections', seeder: new SectionSeeder(users, portfolios, sections, registry, reference, env) },
  ]);
  return { users, portfolios, sections, all };
}

describe('seed:all (section-engine.AC12)', () => {
  it('section-engine.IT11 — creates the account, its portfolio and every section once', async () => {
    const { users, portfolios, sections, all } = build();

    await expect(all.run()).resolves.toEqual([
      { name: 'owner', outcome: 'created' },
      { name: 'portfolio', outcome: 'created' },
      { name: 'sections', outcome: 'created' },
    ]);

    const user = await users.findByEmail(ENV.OWNER_EMAIL);
    const portfolio = await portfolios.findByUserId(user?.id ?? '');
    expect(portfolio).toMatchObject({ slug: 'ghulam', sectionOrder: ['about', 'work'] });
    const stored = await sections.listByPortfolio(portfolio?.id ?? '');
    expect(stored.map((section) => section.type)).toEqual(['hero', 'about', 'work']);
    expect(stored.find((section) => section.type === 'about')?.data).toEqual(REFERENCE.about);
    expect(stored.find((section) => section.type === 'work')?.data).toEqual(new FakeSectionDefinition().defaults());
  });

  it('section-engine.IT11 — a second run, and a run after an edit, create and overwrite nothing', async () => {
    const { users, portfolios, sections, all } = build();
    await all.run();
    const portfolio = await portfolios.findByUserId((await users.findByEmail(ENV.OWNER_EMAIL))?.id ?? '');
    await sections.update(portfolio?.id ?? '', 'about', 1, { data: { heading: 'Edited', items: [], tags: [] } });

    await expect(all.run()).resolves.toEqual([
      { name: 'owner', outcome: 'unchanged' },
      { name: 'portfolio', outcome: 'unchanged' },
      { name: 'sections', outcome: 'unchanged' },
    ]);
    await expect(sections.find(portfolio?.id ?? '', 'about')).resolves.toMatchObject({ data: { heading: 'Edited' } });
  });

  it('refuses seed data that fails its schema or lacks fixed item ids, writing no section', async () => {
    const invalid = build({ about: { heading: '', items: [], tags: [] } });
    await expect(invalid.all.run()).rejects.toBeInstanceOf(SeedDataError);

    const noIds = build({ about: { heading: 'H', items: [{ title: 'No id' }], tags: [] } });
    await expect(noIds.all.run()).rejects.toThrow(/without a fixed id/);
  });

  it('refuses in production and without the account', async () => {
    const production = build(REFERENCE, { NODE_ENV: 'production', OWNER_EMAIL: ENV.OWNER_EMAIL });
    await expect(
      new PortfolioSeeder(production.users, production.portfolios, registryOf([]), {
        NODE_ENV: 'production',
        OWNER_EMAIL: ENV.OWNER_EMAIL,
      }).run(),
    ).rejects.toBeInstanceOf(SeedRefusedError);

    const noAccount = build();
    await expect(
      new PortfolioSeeder(noAccount.users, noAccount.portfolios, registryOf([]), ENV).run(),
    ).rejects.toBeInstanceOf(SeedConfigurationError);
  });
});
