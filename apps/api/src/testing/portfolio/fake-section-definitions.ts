/**
 * Test-only section definitions (`section-engine.test_cases.md`: the engine is tested
 * independently of the six real section types). `FakeSectionDefinition` has a heading and a
 * list of items, so it exercises `plainText` cleaning and item-id assignment; `FakeHeroDefinition`
 * is neither orderable nor hideable, like `hero`.
 */
import { listItem, plainText } from '@portfolio/contracts';
import { z } from 'zod';

import type { ISectionDefinition } from '../../modules/portfolio/index.js';

export const fakeSectionSchema = z.object({
  heading: plainText(40),
  items: z.array(listItem({ title: plainText(20) })).max(10),
  tags: z.array(plainText(10)).max(5),
});
export type FakeSection = z.infer<typeof fakeSectionSchema>;

export class FakeSectionDefinition implements ISectionDefinition<FakeSection> {
  readonly label: string;
  readonly orderable = true;
  readonly hideable = true;
  readonly inNav = true;
  readonly schema = fakeSectionSchema;

  constructor(readonly type = 'fake') {
    this.label = `Fake ${type}`;
  }

  defaults(): FakeSection {
    return { heading: '[Your heading]', items: [{ title: '[Item]' }], tags: [] };
  }
}

export class FakeHeroDefinition implements ISectionDefinition<{ title: string }> {
  readonly type = 'hero';
  readonly label = 'Hero';
  readonly orderable = false;
  readonly hideable = false;
  readonly inNav = false;
  readonly schema = z.object({ title: plainText(40) });

  defaults(): { title: string } {
    return { title: '[Your headline]' };
  }
}
