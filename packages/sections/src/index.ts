/**
 * Public surface of `@portfolio/sections`.
 *
 * Owns the section renderers, the layout variant registry and the page composer that both the
 * public site and the CMS preview render through (`architecture.md` → Shared packages). The
 * composer and registry arrived with `section-engine.T07`; renderers arrive with each section
 * spec.
 */
export { rendererRegistry, SECTION_RENDERERS } from './catalog.js';
export { composeSections, HERO_TYPE, type ComposableSection, type PlacedSection } from './compose.js';
export { PortfolioPage, type PortfolioPageProps } from './portfolio-page.js';
export {
  DEFAULT_VARIANT,
  SectionRendererRegistry,
  type AnySectionRenderer,
  type SectionRendererEntry,
  type SectionRendererProps,
} from './registry.js';
