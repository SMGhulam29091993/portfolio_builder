/**
 * The renderer catalogue: every section renderer and layout variant this build ships
 * (`int-standards.nextjs.md` → Adding a section type or layout variant, step 2). Each section
 * spec adds its entries here; the public site and the CMS preview both render through
 * `rendererRegistry`, so there is one renderer per section (`section-engine.T07`).
 */
import { SectionRendererRegistry, type SectionRendererEntry } from './registry.js';

/** Every registered renderer, in no particular order. */
export const SECTION_RENDERERS: readonly SectionRendererEntry[] = [];

export const rendererRegistry = new SectionRendererRegistry(SECTION_RENDERERS);
