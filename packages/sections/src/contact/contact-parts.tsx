/**
 * The contact actions shared by both variants (`contact-section.T02`; AC5, AC8): the email
 * button (`mailto:` the identity's address, subject URL-encoded), the copy chip and the social
 * links with visible names.
 */
import type { ContactSection, Identity } from '@portfolio/contracts';

import { ArrowUpRightIcon, SocialTextLinks } from '../shared/index.js';
import { CopyEmailChip } from './copy-email-chip.js';

export function mailtoHref(email: string, subject: string | undefined): string {
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}

export function ContactActions({ data, identity, align }: { data: ContactSection; identity: Identity | null; align: 'center' | 'start' }) {
  if (!identity) return null;
  return (
    <div className={`flex flex-col gap-6 ${align === 'center' ? 'items-center' : 'items-start'}`}>
      <div className={`flex w-full flex-wrap items-center gap-3 ${align === 'center' ? 'justify-center' : ''}`}>
        <a
          href={mailtoHref(identity.email, data.emailCta.subject)}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-3 text-sm font-medium text-on-accent hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {data.emailCta.label}
          <ArrowUpRightIcon className="h-4 w-4" />
        </a>
        {data.showCopyEmail ? <CopyEmailChip email={identity.email} /> : null}
      </div>
      {data.showSocialLinks ? <SocialTextLinks identity={identity} /> : null}
    </div>
  );
}
