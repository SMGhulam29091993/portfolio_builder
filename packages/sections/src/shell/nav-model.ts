/**
 * What the site nav shows (`public-site-rendering.T04`; AC3, AC5; UT03, UT04), derived from
 * published content only: the monogram, one link per visible section whose meta asks for a nav
 * entry (in page order, `contact` flagged for its filled pill), and the résumé when one is set.
 * Pure data, so the rules are tested without rendering.
 */
import type { Identity } from '@portfolio/contracts';

/** One nav link: the section anchor and its label. */
export interface NavLink {
  readonly type: string;
  readonly label: string;
  /** `contact` is a permanent filled pill (OQ1 resolved). */
  readonly emphasis: boolean;
}

export interface NavModel {
  readonly monogram: string;
  /** Read by assistive technology for the monogram's link to the top. */
  readonly ownerName: string;
  readonly links: readonly NavLink[];
  readonly resume: { readonly label: string; readonly href: string } | null;
}

/** The section that gets the filled pill. */
const EMPHASISED_TYPE = 'contact';

/** A section's `meta` as the nav needs it; every section payload but the hero's has one. */
function navEntryOf(data: unknown): string | null {
  if (typeof data !== 'object' || data === null || !('meta' in data)) return null;
  const { meta } = data;
  if (typeof meta !== 'object' || meta === null) return null;
  const show = 'showInNav' in meta ? meta.showInNav : false;
  const label = 'navLabel' in meta ? meta.navLabel : null;
  return show === true && typeof label === 'string' && label.trim() !== '' ? label : null;
}

/**
 * @param sections - The published sections, visible only, in page order.
 * @param resumeHref - The résumé's public URL, or `null` when the snapshot has none.
 */
export function buildNavModel(
  identity: Identity,
  sections: readonly { readonly type: string; readonly data: unknown }[],
  resumeHref: string | null,
): NavModel {
  const links: NavLink[] = [];
  for (const { type, data } of sections) {
    const label = navEntryOf(data);
    if (label) links.push({ type, label, emphasis: type === EMPHASISED_TYPE });
  }
  return {
    monogram: identity.monogram,
    ownerName: identity.fullName,
    links,
    resume: resumeHref ? { label: identity.resume.label, href: resumeHref } : null,
  };
}
