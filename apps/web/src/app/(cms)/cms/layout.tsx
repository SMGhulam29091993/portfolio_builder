/**
 * CMS panel layout. Every `/cms/**` page is excluded from search indexing
 * (`int-standards.nextjs.md` → Structure). Authentication is added by `owner-auth`.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function CmsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
