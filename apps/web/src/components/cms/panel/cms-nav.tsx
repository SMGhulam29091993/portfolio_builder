'use client';
/**
 * The CMS navigation (`cms-panel-shell.AC4`): Overview, the section types in portfolio order,
 * then the fixed areas. Built from `section-engine.API02` and the draft's order.
 */
import { usePathname } from 'next/navigation';

import { usePortfolioDraft, useSectionTypes } from '../../../lib/api/portfolio';
import { FIXED_AREAS, sectionNav, type NavItem } from '../../../lib/cms/nav';
import { GuardedLink } from './guarded-link';

export function CmsNav() {
  const pathname = usePathname();
  const types = useSectionTypes();
  const draft = usePortfolioDraft();
  const sections = types.data ? sectionNav(types.data, draft.data?.portfolio.sectionOrder ?? []) : [];

  const item = ({ href, label }: NavItem) => (
    <li key={href}>
      <GuardedLink
        href={href}
        current={pathname === href}
        className={`block rounded-lg px-3 py-2 text-sm ${
          pathname === href ? 'bg-neutral-800 text-white' : 'text-neutral-300 hover:bg-neutral-900 hover:text-white'
        }`}
      >
        {label}
      </GuardedLink>
    </li>
  );

  return (
    <nav aria-label="CMS" className="flex flex-col gap-6">
      <ul className="flex flex-col gap-1">{item({ href: '/cms', label: 'Overview' })}</ul>
      <div>
        <h2 className="px-3 pb-2 text-xs font-medium uppercase tracking-widest text-neutral-400">Sections</h2>
        {types.isError ? (
          <p className="px-3 text-sm text-red-300">Sections could not be loaded.</p>
        ) : (
          <ul className="flex flex-col gap-1">{sections.map(item)}</ul>
        )}
      </div>
      <div>
        <h2 className="px-3 pb-2 text-xs font-medium uppercase tracking-widest text-neutral-400">Site</h2>
        <ul className="flex flex-col gap-1">{FIXED_AREAS.map(item)}</ul>
      </div>
    </nav>
  );
}
