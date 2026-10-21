/**
 * Root layout shared by both route groups: `(site)` (the published portfolio) and `(cms)` (the
 * CMS panel). It owns only the document shell and the global stylesheet; each group adds its
 * own metadata and chrome.
 */
import type { ReactNode } from 'react';

import { FONT_VARIABLE_CLASSES } from '../lib/fonts';
import './globals.css';

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    // The document language is fixed until `site-identity` stores one.
    // Every allowed font's variable is defined at the root; a theme picks among them.
    <html lang="en" className={FONT_VARIABLE_CLASSES}>
      <body>{children}</body>
    </html>
  );
}
