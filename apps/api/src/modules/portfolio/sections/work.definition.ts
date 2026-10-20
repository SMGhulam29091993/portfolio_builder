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
      heading: { lead: '[Work that', emphasis: 'matters.]' },
      featuredBadge: 'Featured',
      projects: [
        {
          title: '[Project name]',
          category: '[What kind of project]',
          description: '[What it does, what you built, and the result.]',
          featured: true,
          metrics: [{ value: '[0]', label: '[What this number measures]' }],
          tags: ['[Tool]'],
          link: null,
        },
      ],
    };
  }
}
