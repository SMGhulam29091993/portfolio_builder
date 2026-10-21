/**
 * The footer (`public-site-rendering.T04`; AC7; `design_reference.md` → Footer): a hairline, then
 * `© <year> <copyrightName>` on one side and `Built with` the credits joined by middle dots on
 * the other; stacked and centred below 768. The year is the render time's (spec → Edge Cases).
 */
import type { Identity } from '@portfolio/contracts';

import { CONTAINER } from '../shared/layout.js';

/** The footer's two lines, as text — kept apart so the rule is tested without rendering (UT05). */
export function footerLines(footer: Identity['footer'], year: number): { copyright: string; credits: string } {
  return {
    copyright: `© ${String(year)} ${footer.copyrightName}`,
    credits: footer.builtWith.length > 0 ? `Built with ${footer.builtWith.join(' · ')}` : '',
  };
}

export function SiteFooter({ footer, year }: { footer: Identity['footer']; year: number }) {
  const { copyright, credits } = footerLines(footer, year);
  return (
    <footer className={CONTAINER}>
      <div className="flex flex-col items-center gap-3 border-t border-border py-10 text-center md:flex-row md:justify-between md:text-left">
        <p className="text-sm text-text-muted">{copyright}</p>
        {credits ? <p className="font-mono text-xs text-text-muted">{credits}</p> : null}
      </div>
    </footer>
  );
}
