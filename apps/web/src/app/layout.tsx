/**
 * Root layout shared by both route groups: `(site)` (the published portfolio) and `(cms)` (the
 * CMS panel). It owns only the document shell and the global stylesheet; each group adds its
 * own metadata and chrome.
 */
import type { ReactNode } from 'react';

import './globals.css';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The document language is fixed until `site-identity` stores one.
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
