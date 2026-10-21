/**
 * `contact` · `glow-card` — the reference layout (`contact-section.T02`; AC3, AC4): one rounded
 * card, centred content — eyebrow (accent), heading (emphasis in the accent), body, buttons,
 * social links — over the dot grid with a glow rising from the bottom edge.
 */
import type { ContactSection } from '@portfolio/contracts';

import { CONTAINER, DotGrid, Glow, SectionHeader, type SectionProps } from '../shared/index.js';
import { ContactActions } from './contact-parts.js';

export function ContactGlowCard({ data, number, context }: SectionProps<ContactSection>) {
  return (
    <section id="contact" aria-labelledby="contact-heading" className="scroll-mt-24 py-16 sm:py-24">
      <div className={CONTAINER}>
        <div className="relative overflow-hidden rounded-[var(--radius)] border border-border bg-surface px-6 py-16 sm:px-12 sm:py-24">
          <DotGrid />
          <Glow position="bottom" />
          <div className="relative flex flex-col items-center text-center">
            <SectionHeader type="contact" number={number} eyebrow={data.meta.eyebrow} heading={data.heading} emphasisTone="accent" align="center" />
            {data.body ? <p className="-mt-4 mb-10 max-w-xl text-lg text-text-muted">{data.body}</p> : null}
            <ContactActions data={data} identity={context.identity} align="center" />
          </div>
        </div>
      </div>
    </section>
  );
}
