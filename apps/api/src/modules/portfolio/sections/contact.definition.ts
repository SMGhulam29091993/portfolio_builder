/** `contact` (`contact-section.T01`): orderable, hideable, in the nav; template defaults. */
import { contactSectionSchema, type ContactSection } from '@portfolio/contracts';

import type { ISectionDefinition } from '../portfolio.interface.js';

export class ContactSectionDefinition implements ISectionDefinition<ContactSection> {
  readonly type = 'contact';
  readonly label = 'Contact';
  readonly orderable = true;
  readonly hideable = true;
  readonly inNav = true;
  readonly schema = contactSectionSchema;

  defaults(): ContactSection {
    return {
      meta: { eyebrow: 'Contact', navLabel: 'Contact', showInNav: true },
      heading: { lead: 'Have something to build?', emphasis: "Let's talk." },
      body: '[What kind of work or roles you are open to.]',
      emailCta: { label: 'Email me' },
      showCopyEmail: true,
      showSocialLinks: true,
    };
  }
}
