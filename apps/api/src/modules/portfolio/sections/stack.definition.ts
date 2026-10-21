/** `stack` (`stack-credentials.T01`): orderable, hideable, in the nav; template defaults. */
import { stackSectionSchema, type StackSection } from '@portfolio/contracts';

import type { ISectionDefinition } from '../portfolio.interface.js';

export class StackSectionDefinition implements ISectionDefinition<StackSection> {
  readonly type = 'stack';
  readonly label = 'Stack';
  readonly orderable = true;
  readonly hideable = true;
  readonly inNav = true;
  readonly schema = stackSectionSchema;

  defaults(): StackSection {
    return {
      meta: { eyebrow: 'Stack', navLabel: 'Stack', showInNav: true },
      heading: { lead: 'The tools', emphasis: 'I reach for.' },
      groups: [{ label: '[Your group]', items: ['[Your tool]', '[Your tool two]'] }],
      education: {
        enabled: true,
        label: 'Education & training',
        entries: [{ title: '[Your degree or course]', institution: '[Your institution]', startYear: 2020, endYear: 2024 }],
      },
      certifications: { enabled: false, label: 'Certifications', entries: [] },
    };
  }
}
