/** `experience` (`experience-timeline.T01`): orderable, hideable, in the nav; template defaults. */
import { experienceSectionSchema, type ExperienceSection } from '@portfolio/contracts';

import type { ISectionDefinition } from '../portfolio.interface.js';

export class ExperienceSectionDefinition implements ISectionDefinition<ExperienceSection> {
  readonly type = 'experience';
  readonly label = 'Experience';
  readonly orderable = true;
  readonly hideable = true;
  readonly inNav = true;
  readonly schema = experienceSectionSchema;

  defaults(): ExperienceSection {
    return {
      meta: { eyebrow: 'Experience', navLabel: 'Experience', showInNav: true },
      heading: { lead: "Where I've", emphasis: 'worked.' },
      presentLabel: 'Present',
      entries: [
        {
          company: '[Your company]',
          role: '[Your role]',
          location: '[Your city]',
          start: { year: 2024, month: 1 },
          end: null,
          highlights: ['[Your achievement there.]'],
        },
      ],
    };
  }
}
