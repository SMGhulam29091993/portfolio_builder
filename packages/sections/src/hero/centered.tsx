/**
 * `hero` · `centered` — the alternate layout (`design-theme` → Variant catalogue): centred text
 * and buttons, the code card below them, the marquee beneath. Same payload.
 */
import type { HeroSection } from '@portfolio/contracts';

import { CONTAINER, DotGrid, Glow, Marquee, type SectionProps } from '../shared/index.js';
import { CodeCard } from './code-card.js';
import { HeroContent } from './hero-content.js';

export function HeroCentered({ data, context }: SectionProps<HeroSection>) {
  return (
    <section id="hero" aria-labelledby="hero-heading" className="relative overflow-hidden pt-28 sm:pt-36">
      <DotGrid />
      <Glow position="top" />
      <div className={`${CONTAINER} relative flex flex-col items-center gap-12 pb-16`}>
        <HeroContent data={data} identity={context.identity} centered />
        {data.codeCard.enabled ? (
          <div className="w-full max-w-2xl">
            <CodeCard card={data.codeCard} identity={context.identity} />
          </div>
        ) : null}
      </div>
      {data.marquee.enabled ? <Marquee items={data.marquee.items} /> : null}
    </section>
  );
}
