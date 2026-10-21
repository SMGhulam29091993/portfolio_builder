'use client';
/**
 * A call-to-action (`hero-section.T02`; AC7): a `section` target jumps to that section's anchor
 * and moves focus to its heading; a `url` target opens in a new tab with
 * `rel="noopener noreferrer"`.
 */
import type { LinkTarget } from '@portfolio/contracts';
import type { ReactNode } from 'react';

import { focusSectionHeading } from './section-anchor.js';

const STYLES = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  secondary: 'border border-border text-text hover:border-text-muted',
} as const;

export function CtaButton({ label, target, variant, icon }: { label: string; target: LinkTarget; variant: keyof typeof STYLES; icon?: ReactNode }) {
  const className = `inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${STYLES[variant]}`;
  if (target.kind === 'url') {
    return (
      <a href={target.url} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
        {icon}
      </a>
    );
  }
  return (
    <a
      href={`#${target.sectionType}`}
      className={className}
      onClick={() => {
        focusSectionHeading(target.sectionType);
      }}
    >
      {label}
      {icon}
    </a>
  );
}
