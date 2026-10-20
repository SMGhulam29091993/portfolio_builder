/** `work` (`work-showcase.T01`): orderable, hideable, in the nav; template defaults. */
import { workSectionSchema, type WorkSection } from '@portfolio/contracts';

import type { ISectionDefinition } from '../portfolio.interface.js';

export class WorkSectionDefinition implements ISectionDefinition<WorkSection> {
  readonly type = 'work';
  readonly label = 'Work';
  readonly orderable = true;
  readonly hideable = true;
  readonly inNav = true;
  readonly schema = workSectionSchema;

  defaults(): WorkSection {
    return {
      meta: { eyebrow: 'Selected work', navLabel: 'Work', showInNav: true },
      heading: { lead: '[Your heading lead]', emphasis: '[Your emphasis.]' },
      featuredBadge: 'Featured',
      projects: [
        {
          title: '[Your project]',
          category: '[Your project category]',
          description: '[Your project story: what it does and the result.]',
          featured: true,
          metrics: [{ value: '[Your stat]', label: '[Your metric label]' }],
          tags: ['[Your tool]'],
          link: null,
        },
      ],
    };
  }
}
