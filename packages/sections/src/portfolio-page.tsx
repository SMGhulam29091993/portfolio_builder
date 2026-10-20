/**
 * `PortfolioPage` — the page composer (`section-engine.T07`; AC13, AC14). The public site and
 * the CMS preview both render a portfolio through it, so there is one renderer per section and
 * one ordering rule (`int-standards.nextjs.md` → Structure).
 *
 * Pure: props in, markup out. A section whose type has no registered renderer is skipped and
 * reported through `onUnknownType` (the web app logs it in development only); the rest of the
 * page renders.
 */
import type { ReactElement } from 'react';

import { composeSections, type ComposableSection } from './compose.js';
import type { SectionRendererRegistry } from './registry.js';

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
}

export function PortfolioPage<Context>({
  sections,
  sectionOrder,
  registry,
  variants = {},
  context,
  onUnknownType,
}: PortfolioPageProps<Context>): ReactElement {
  const placed = composeSections(sections, sectionOrder);
  return (
    <>
      {placed.map((section) => {
        const Renderer = registry.get(section.type, variants[section.type]);
        if (!Renderer) {
          onUnknownType?.(section.type);
          return null;
        }
        return (
          <Renderer
            key={section.type}
            data={section.data}
            number={section.number}
            position={section.position}
            context={context}
          />
        );
      })}
    </>
  );
}
