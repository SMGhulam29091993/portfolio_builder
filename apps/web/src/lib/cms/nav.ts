/**
 * The CMS navigation model (`cms-panel-shell.AC4`): the section types in portfolio order —
 * `hero` first, then `sectionOrder`, then any type the order does not list — followed by the
 * fixed areas. Pure, so the order rule is unit-tested.
 */
import type { SectionTypeInfo } from '@portfolio/contracts';

export interface NavItem {
  readonly href: string;
  readonly label: string;
}

/** The areas every user has, in order, after the sections. */
export const FIXED_AREAS: readonly NavItem[] = [
  { href: '/cms/identity', label: 'Identity' },
  { href: '/cms/design', label: 'Design' },
  { href: '/cms/assets', label: 'Assets' },
  { href: '/cms/ai', label: 'AI Studio' },
  { href: '/cms/publish', label: 'Publish' },
];

export function sectionNav(types: readonly SectionTypeInfo[], sectionOrder: readonly string[]): NavItem[] {
  const byType = new Map(types.map((info) => [info.type, info]));
  const ordered: SectionTypeInfo[] = [];
  const push = (info: SectionTypeInfo | undefined) => {
    if (info && !ordered.includes(info)) ordered.push(info);
  };
  push(types.find((info) => !info.orderable));
  for (const type of sectionOrder) push(byType.get(type));
  for (const info of types) push(info);
  return ordered.map((info) => ({ href: `/cms/sections/${info.type}`, label: info.label }));
}
