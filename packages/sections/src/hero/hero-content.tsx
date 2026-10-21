/**
 * The hero's text column, shared by both variants (`hero-section.T03`; AC4–AC8): badge, the
 * page's only `h1` with its emphasis in the display font and the accent colour, the intro with the
 * identity's name, the buttons and the social icons.
 */
import type { HeroSection, Identity } from '@portfolio/contracts';

import { ArrowDownRightIcon, ArrowUpRightIcon, AvailabilityBadge, CtaButton, EmphasisHeadingText, headingId, SocialIconRow } from '../shared/index.js';

export function HeroContent({ data, identity, centered }: { data: HeroSection; identity: Identity | null; centered: boolean }) {
  const { intro } = data;
  return (
    <div className={`flex min-w-0 flex-col gap-6 ${centered ? 'items-center text-center' : ''}`}>
      {data.showAvailability ? <AvailabilityBadge identity={identity} /> : null}
      <h1 id={headingId('hero')} tabIndex={-1} className="text-4xl font-semibold leading-tight tracking-tight text-text outline-none sm:text-6xl">
        <EmphasisHeadingText heading={data.heading} tone="accent" />
      </h1>
      <p className="max-w-xl text-lg leading-relaxed text-text-muted">
        {intro.prefix ? `${intro.prefix} ` : ''}
        {intro.showName && identity ? (
          <>
            <strong className="font-semibold text-text">{identity.fullName}</strong> —{' '}
          </>
        ) : null}
        {intro.body}
      </p>
      <div className={`flex flex-wrap items-center gap-3 ${centered ? 'justify-center' : ''}`}>
        <CtaButton label={data.primaryCta.label} target={data.primaryCta.target} variant="primary" icon={<ArrowDownRightIcon className="h-4 w-4" />} />
        {data.secondaryCta ? (
          <CtaButton label={data.secondaryCta.label} target={data.secondaryCta.target} variant="secondary" icon={<ArrowUpRightIcon className="h-4 w-4" />} />
        ) : null}
        {data.showSocialIcons ? <SocialIconRow identity={identity} /> : null}
      </div>
    </div>
  );
}
