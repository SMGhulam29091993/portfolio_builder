/**
 * `publish-pipeline.CT01` — `IDraftContributor` for `sections` (`publish-pipeline.T02`).
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { FakeHeroDefinition, FakeSectionDefinition, InMemoryPortfolioRepository, InMemorySectionRepository } from '../../testing/index.js';
import { SectionRegistry } from './section.registry.js';
import { SectionsDraftContributor } from './sections-draft.contributor.js';

let portfolios: InMemoryPortfolioRepository;
let sections: InMemorySectionRepository;
let contributor: SectionsDraftContributor;

beforeEach(() => {
  portfolios = new InMemoryPortfolioRepository();
  sections = new InMemorySectionRepository();
  contributor = new SectionsDraftContributor(
    portfolios,
    sections,
    new SectionRegistry([new FakeHeroDefinition(), new FakeSectionDefinition('about'), new FakeSectionDefinition('work')]),
  );
});

describe('publish-pipeline.CT01 — SectionsDraftContributor', () => {
  it('reports every registered section with its visibility, and the fixed-then-ordered render order', async () => {
    const portfolio = await portfolios.create({ userId: 'u1', slug: 'ada', sectionOrder: ['work', 'about'] });
    await sections.create(portfolio.id, { type: 'hero', visible: true, data: { title: 'h' } });
    await sections.create(portfolio.id, { type: 'about', visible: false, data: { title: 'a' } });
    await sections.create(portfolio.id, { type: 'work', visible: true, data: { title: 'w' } });
    await sections.create(portfolio.id, { type: 'retired', visible: true, data: {} });
    const before = structuredClone(await sections.listByPortfolio(portfolio.id));

    const draft = await contributor.collect({ portfolioId: portfolio.id, userId: 'u1' });

    expect(contributor.key).toBe('sections');
    expect(draft.order).toEqual(['hero', 'work', 'about']);
    expect(draft.sections).toEqual([
      { type: 'hero', visible: true, data: { title: 'h' } },
      { type: 'about', visible: false, data: { title: 'a' } },
      { type: 'work', visible: true, data: { title: 'w' } },
    ]);
    // Read-only.
    expect(await sections.listByPortfolio(portfolio.id)).toEqual(before);
  });

  it('fails for an unknown portfolio', async () => {
    await expect(contributor.collect({ portfolioId: 'missing', userId: 'u1' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
