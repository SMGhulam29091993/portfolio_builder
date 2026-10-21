/** `contact` · `minimal` — the alternate layout: left-aligned heading and links, no card. */
import type { ContactSection } from '@portfolio/contracts';

import { SectionShell, type SectionProps } from '../shared/index.js';
import { ContactActions } from './contact-parts.js';

export function ContactMinimal({ data, number, context }: SectionProps<ContactSection>) {
  return (
    <SectionShell type="contact" number={number} eyebrow={data.meta.eyebrow} heading={data.heading} emphasisTone="accent">
      {data.body ? <p className="mb-8 max-w-xl text-lg text-text-muted">{data.body}</p> : null}
      <ContactActions data={data} identity={context.identity} align="start" />
    </SectionShell>
  );
}
