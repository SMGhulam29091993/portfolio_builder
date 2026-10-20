/**
 * Layout of every `/cms/**` page. Every page is excluded from search indexing
 * (`cms-panel-shell.AC12`; `int-standards.nextjs.md` → Structure), and every page gets the
 * client providers. The signed-in frame (navigation, header) is the `(panel)` group's layout;
 * the sign-in, registration and reset screens in `(auth)` render without it.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { CmsProviders } from './providers';

export const metadata: Metadata = {
  title: 'Portfolio Builder',
  robots: { index: false, follow: false },
};

export default function CmsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <CmsProviders>{children}</CmsProviders>;
}
