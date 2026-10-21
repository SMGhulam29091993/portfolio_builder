/**
 * `PortfolioPage` — the page composer (`section-engine.T07`; AC13, AC14). The public site and
 * the CMS preview both render a portfolio through it, so there is one renderer per section and
 * one ordering rule (`int-standards.nextjs.md` → Structure).
 *
 * Pure: props in, markup out. A section whose type has no registered renderer is skipped and
 * reported through `onUnknownType` (the web app logs it in development only); the rest of the
 * page renders.
 */
import type { CustomLayout } from '@portfolio/design-tokens';
import { Fragment, type ReactElement, type ReactNode } from 'react';

import { composeSections, type ComposableSection } from './compose.js';
import { CustomLayoutRenderer } from './custom/custom-layout.js';
import type { SectionRendererRegistry } from './registry.js';
import type { SectionContext } from './shared/context.js';

export interface PortfolioPageProps<Context = unknown> {
  readonly sections: readonly ComposableSection[];
  /** Orderable types in page order (`portfolios.sectionOrder`). */
  readonly sectionOrder: readonly string[];
  readonly registry: SectionRendererRegistry<Context>;
  /** The layout variant chosen per type (`design-theme`); absent types use `default`. */
  readonly variants?: Readonly<Record<string, string>>;
  /** Page-wide data passed to every renderer unchanged (identity, …). */
  readonly context: Context;
  /** Called once per section skipped for want of a renderer (AC14). */
  readonly onUnknownType?: (type: string) => void;
  /**
   * Wraps each rendered section — the CMS preview puts an error boundary around each, so one
   * broken section names itself instead of blanking the page (`cms-panel-shell` → Edge Cases).
   */
  readonly wrapSection?: (type: string, section: ReactNode) => ReactNode;
  /**
   * Custom layouts by section type (`design-library`; ADR-0014): a type listed here is drawn from
   * its layout, whatever `variants` says. The site passes the snapshot's copies, the CMS the
   * library layouts its design names, or a proposal's own.
   */
  readonly customLayouts?: Readonly<Partial<Record<string, CustomLayout>>>;
}

export function PortfolioPage<Context>({
  sections,
  sectionOrder,
  registry,
  variants = {},
  context,
  onUnknownType,
  wrapSection,
  customLayouts,
}: PortfolioPageProps<Context>): ReactElement {
  const placed = composeSections(sections, sectionOrder);
  return (
    <>
      {placed.map((section) => {
        const custom = customLayouts?.[section.type];
        if (custom?.section === section.type) {
          const drawn = (
            // Every page in this app passes `SectionContext`; the composer is generic only so its
            // tests can use a smaller one.
            <CustomLayoutRenderer layout={custom} data={section.data} number={section.number} position={section.position} context={context as unknown as SectionContext} />
          );
          return <Fragment key={section.type}>{wrapSection ? wrapSection(section.type, drawn) : drawn}</Fragment>;
        }
        const Renderer = registry.get(section.type, variants[section.type]);
        if (!Renderer) {
          onUnknownType?.(section.type);
          return null;
        }
        const rendered = (
          <Renderer data={section.data} number={section.number} position={section.position} context={context} />
        );
        return <Fragment key={section.type}>{wrapSection ? wrapSection(section.type, rendered) : rendered}</Fragment>;
      })}
    </>
  );
}
