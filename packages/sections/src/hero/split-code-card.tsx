/**
 * `hero` · `split-code-card` — the reference layout (`hero-section.T03`; AC3): text left and the
 * code card right, vertically centred, the marquee full-width beneath; one column at 390 in the
 * order badge, heading, intro, buttons, icons, card, marquee.
 */
import type { HeroSection } from '@portfolio/contracts';

import { CONTAINER, DotGrid, Glow, Marquee, type SectionProps } from '../shared/index.js';
import { CodeCard } from './code-card.js';
import { HeroContent } from './hero-content.js';

export function HeroSplitCodeCard({ data, context }: SectionProps<HeroSection>) {
  return (
    <section id="hero" aria-labelledby="hero-heading" className="relative overflow-hidden pt-28 sm:pt-36">
      <DotGrid />
      <Glow position="top" />
      <div className={`${CONTAINER} relative grid items-center gap-12 pb-16 lg:grid-cols-[1.1fr_1fr]`}>
        <HeroContent data={data} identity={context.identity} centered={false} />
        {data.codeCard.enabled ? <CodeCard card={data.codeCard} identity={context.identity} /> : null}
      </div>
      {data.marquee.enabled ? <Marquee items={data.marquee.items} /> : null}
    </section>
  );
}
