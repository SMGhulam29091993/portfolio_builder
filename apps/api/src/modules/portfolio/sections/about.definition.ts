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
      heading: { lead: '[What you do,]', emphasis: '[how you do it.]' },
      bio: '[A short paragraph about your experience and what you care about.]',
      currently: { enabled: true, label: 'Currently', text: '[Your current role]' },
      stats: [
        { value: '[0+]', label: '[What this number measures]' },
        { value: '[0+]', label: '[What this number measures]' },
      ],
      process: {
        enabled: true,
        eyebrow: 'How I work',
        title: '[How you work, in one line.]',
        steps: [
          { title: '[Step one]', description: '[What happens in this step.]' },
          { title: '[Step two]', description: '[What happens in this step.]' },
        ],
      },
    };
  }
}
