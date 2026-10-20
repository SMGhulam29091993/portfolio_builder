'use client';
/**
 * A nav link to a section (`public-site-rendering.AC6`): a plain `#<type>` anchor — so it works
 * without JavaScript and updates the URL hash — that also moves focus to the section heading.
 */
import type { ReactNode } from 'react';

import { focusSectionHeading } from '../shared/section-anchor.js';

export function SectionLink({
  type,
  className,
  onNavigate,
  children,
}: {
  type: string;
  className: string;
  onNavigate?: () => void;
  children: ReactNode;
}) {
  return (
    <a
      href={`#${type}`}
      className={className}
      onClick={() => {
        onNavigate?.();
        focusSectionHeading(type);
      }}
    >
      {children}
    </a>
  );
}
