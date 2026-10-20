/**
 * `PortfolioProvisioner` and `initialSlug` (`section-engine.UT13`–`UT15`; AC15, AC17).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import {
  FakeHeroDefinition,
  FakeSectionDefinition,
  InMemoryPortfolioRepository,
  InMemorySectionRepository,
} from '../../testing/index.js';
import type { IUserDirectory } from './portfolio.interface.js';
import { initialSlug, PortfolioProvisioner } from './portfolio.provisioner.js';
import { SectionRegistry } from './section.registry.js';

class Directory implements IUserDirectory {
  constructor(private readonly names: Record<string, string>) {}
  displayNameOf(userId: string): Promise<string | null> {
    return Promise.resolve(this.names[userId] ?? null);
  }
}

let portfolios: InMemoryPortfolioRepository;
let sections: InMemorySectionRepository;
let provisioner: PortfolioProvisioner;

beforeEach(() => {
  portfolios = new InMemoryPortfolioRepository();
  sections = new InMemorySectionRepository();
  provisioner = new PortfolioProvisioner(
    portfolios,
    sections,
    new SectionRegistry([new FakeHeroDefinition(), new FakeSectionDefinition('about'), new FakeSectionDefinition('work')]),
    new Directory({ ann: 'Ann Lee', bo: 'Ann Lee', cy: '<b>' }),
  );
});

describe('initialSlug (section-engine.UT13)', () => {
  it.each([
    ['S M Ghulam Ghaus Faiyaz', 's-m-ghulam-ghaus-faiyaz'],
    ['  Zoë  Ångström ', 'zoe-angstrom'],
    ['A', 'portfolio'],
    ['', 'portfolio'],
    ['!!!', 'portfolio'],
    ['Admin', 'portfolio'],
    ['A very long display name that keeps going and going', 'a-very-long-display-name-that-ke'],
  ])('%j → %j', (name, slug) => {
    expect(initialSlug(name)).toBe(slug);
  });
});

describe('resolveFor (section-engine.UT14 / AC15)', () => {
  it('creates the portfolio and every section from the template, visible, once', async () => {
    const first = await provisioner.resolveFor('ann');
    const second = await provisioner.resolveFor('ann');

    expect(second).toEqual(first);
    expect(first).toMatchObject({ userId: 'ann', slug: 'ann-lee', sectionOrder: ['about', 'work'], revision: 1 });
    const stored = await sections.listByPortfolio(first.id);
    expect(stored.map((section) => [section.type, section.visible, section.revision])).toEqual([
      ['hero', true, 1],
      ['about', true, 1],
      ['work', true, 1],
    ]);
    expect(stored[1]?.data).toEqual(new FakeSectionDefinition().defaults());
  });

  it('suffixes a taken slug and falls back for an unusable name', async () => {
    await provisioner.resolveFor('ann');

    await expect(provisioner.resolveFor('bo')).resolves.toMatchObject({ slug: 'ann-lee-2' });
    await expect(provisioner.resolveFor('cy')).resolves.toMatchObject({ slug: 'portfolio' });
    await expect(provisioner.resolveFor('nobody')).resolves.toMatchObject({ slug: 'portfolio-2' });
  });

  it('two parallel first calls leave one portfolio', async () => {
    const [a, b] = await Promise.all([provisioner.resolveFor('ann'), provisioner.resolveFor('ann')]);

    expect(a.id).toBe(b.id);
  });
});

describe('changeSlug (section-engine.UT15 / AC17)', () => {
  it('stores a free slug, refuses reserved and taken ones, and reports a stale revision', async () => {
    const mine = await provisioner.resolveFor('ann');
    await provisioner.resolveFor('bo');

    await expect(provisioner.changeSlug(mine.id, 1, 'cms')).rejects.toMatchObject({ code: 'SLUG_TAKEN' });
    await expect(provisioner.changeSlug(mine.id, 1, 'ann-lee-2')).rejects.toMatchObject({ code: 'SLUG_TAKEN' });
    await expect(provisioner.changeSlug(mine.id, 1, 'ghulam')).resolves.toMatchObject({ slug: 'ghulam', revision: 2 });
    await expect(provisioner.changeSlug(mine.id, 1, 'other')).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
      details: { currentRevision: 2 },
    });
  });
});
