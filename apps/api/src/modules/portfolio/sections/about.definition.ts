/** `about` (`about-section.T01`): orderable, hideable, in the nav; template defaults. */
import { aboutSectionSchema, type AboutSection } from '@portfolio/contracts';

import type { ISectionDefinition } from '../portfolio.interface.js';

export class AboutSectionDefinition implements ISectionDefinition<AboutSection> {
  readonly type = 'about';
  readonly label = 'About';
  readonly orderable = true;
  readonly hideable = true;
  readonly inNav = true;
  readonly schema = aboutSectionSchema;

  defaults(): AboutSection {
    return {
      meta: { eyebrow: 'About', navLabel: 'About', showInNav: true },
      heading: { lead: '[Your lead,]', emphasis: '[Your emphasis.]' },
      bio: '[Your bio: your experience and what you care about.]',
      currently: { enabled: true, label: 'Currently', text: '[Your current role]' },
      stats: [
        { value: '[Your stat]', label: '[Your metric label]' },
        { value: '[Your stat]', label: '[Your metric label]' },
      ],
      process: {
        enabled: true,
        eyebrow: 'How I work',
        title: '[Your way of working, in one line.]',
        steps: [
          { title: '[Your step one]', description: '[Your description of this step.]' },
          { title: '[Your step two]', description: '[Your description of this step.]' },
        ],
      },
    };
  }
}
