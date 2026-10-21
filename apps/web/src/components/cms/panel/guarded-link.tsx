'use client';
/**
 * A CMS navigation link that asks before discarding unsaved changes (`cms-panel-shell.AC8`).
 * A plain anchor with Next's client navigation, so it works with the keyboard and in a new tab.
 */
import Link from 'next/link';
import type { ReactNode } from 'react';

import { confirmDiscard } from '../../../lib/cms/ui-store';
import { focusRing } from '../ui';

export function GuardedLink({
  href,
  children,
  current = false,
  className,
}: {
  href: string;
  children: ReactNode;
  current?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-current={current ? 'page' : undefined}
      onClick={(event) => {
        if (!confirmDiscard()) event.preventDefault();
      }}
      className={`${focusRing} ${className ?? ''}`}
    >
      {children}
    </Link>
  );
}
