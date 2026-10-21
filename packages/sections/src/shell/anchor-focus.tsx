'use client';
/**
 * On first load with a section hash (`/<slug>#work`), moves focus to that section's heading
 * once the page is interactive (`public-site-rendering` → Edge Cases), so the first Tab
 * continues from there. Renders nothing.
 */
import { useEffect } from 'react';

import { focusSectionHeading } from '../shared/section-anchor.js';

export function AnchorFocus() {
  useEffect(() => {
    const type = decodeURIComponent(window.location.hash.slice(1));
    if (/^[a-z][a-z0-9-]*$/.test(type)) focusSectionHeading(type);
  }, []);
  return null;
}
