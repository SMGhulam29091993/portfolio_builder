/**
 * The floating nav pill (`public-site-rendering.T04`; AC3, AC4, AC5; `design_reference.md` →
 * Nav): fixed at the top, centred. At 768 and wider: the monogram in an accent circle (to the
 * top), one muted link per section, `Contact` as a filled pill, the résumé as an outlined pill.
 * Below 768: the monogram, the résumé pill and the "Menu" button. No résumé, no pill — at any
 * width.
 */
import { MobileMenu } from './mobile-menu.js';
import type { NavModel } from './nav-model.js';
import { SectionLink } from './section-link.js';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** The id of the page's first element, the monogram's target. */
export const TOP_ANCHOR = 'top';

export function SiteNav({ model }: { model: NavModel }) {
  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <nav aria-label="Main" className="relative flex items-center gap-1 rounded-full border border-border bg-surface/90 p-1.5 shadow-2xl backdrop-blur">
        <a
          href={`#${TOP_ANCHOR}`}
          aria-label={`${model.ownerName}, back to top`}
          className={`flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-semibold text-on-accent ${FOCUS}`}
        >
          {model.monogram}
        </a>
        {model.links.length > 0 ? (
          <ul className="hidden items-center gap-1 md:flex">
            {model.links.map((link) => (
              <li key={link.type}>
                <SectionLink
                  type={link.type}
                  className={`block rounded-full px-4 py-2 text-sm transition ${link.emphasis ? 'bg-surface-raised text-text hover:brightness-125' : 'text-text-muted hover:text-text'} ${FOCUS}`}
                >
                  {link.label}
                </SectionLink>
              </li>
            ))}
          </ul>
        ) : null}
        <MobileMenu links={model.links} />
        {model.resume ? (
          <a
            href={model.resume.href}
            target="_blank"
            rel="noopener noreferrer"
            className={`rounded-full border border-border px-4 py-2 text-sm text-text transition hover:border-text-muted ${FOCUS}`}
          >
            {model.resume.label}
          </a>
        ) : null}
      </nav>
    </header>
  );
}
