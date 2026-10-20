/**
 * `hero` (`hero-section.T01`): always first, never hidden, not in the nav. `defaults()` is the
 * reference template with placeholders (ADR-0010; `hero-section` → Status).
 */
import { heroSectionSchema, type HeroSection } from '@portfolio/contracts';

import type { ISectionDefinition } from '../portfolio.interface.js';

export class HeroSectionDefinition implements ISectionDefinition<HeroSection> {
  readonly type = 'hero';
  readonly label = 'Hero';
  readonly orderable = false;
  readonly hideable = false;
  readonly inNav = false;
  readonly schema = heroSectionSchema;

  defaults(): HeroSection {
    return {
      heading: { lead: '[Your headline]', emphasis: '[your promise.]' },
      intro: { prefix: "Hi, I'm", showName: true, body: '[One or two sentences about what you build and for whom.]' },
      primaryCta: { label: 'See my work', target: { kind: 'section', sectionType: 'work' } },
      secondaryCta: { label: 'Get in touch', target: { kind: 'section', sectionType: 'contact' } },
      showAvailability: true,
      showSocialIcons: true,
      codeCard: {
        enabled: true,
        filename: '[you].config.ts',
        exportName: 'me',
        showLocation: true,
        entries: [
          { key: 'role', value: '[Your role]' },
          { key: 'stack', value: ['[Tool]', '[Tool]'] },
        ],
      },
      marquee: { enabled: true, items: ['[Skill one]', '[Skill two]', '[Skill three]', '[Skill four]'] },
    };
  }
}
