/**
 * A published portfolio's page (`public-site-rendering.T02`, `T04`; AC1, AC3–AC7, AC10, AC19):
 * the theme as CSS variables on the server-rendered root, the skip link first, the floating nav,
 * every published section through the shared composer, and the footer. Everything comes from
 * the snapshot; nothing here reads a draft.
 */
import { publicAssetPath } from '@portfolio/contracts';
import {
  AnchorFocus,
  buildNavModel,
  MAIN_ID,
  PortfolioPage,
  rendererRegistry,
  RevealOnScroll,
  SiteFooter,
  SiteNav,
  SkipLink,
  ThemeRoot,
  TOP_ANCHOR,
} from '@portfolio/sections';

import type { RenderableContent } from '../../lib/site/snapshot-adapter';
import { PublicSectionBoundary } from './public-section-boundary';

export function SitePage({ slug, content, year }: { slug: string; content: RenderableContent; year: number }) {
  const resumeId = content.identity.resume.assetId;
  const resume = resumeId ? content.assets.find((asset) => asset.id === resumeId && asset.kind === 'resume') : undefined;
  const nav = buildNavModel(content.identity, content.sections, resume ? publicAssetPath(slug, resume) : null);
  return (
    <ThemeRoot theme={content.theme} className="min-h-screen">
      <SkipLink />
      <div id={TOP_ANCHOR} />
      <SiteNav model={nav} />
      <main id={MAIN_ID} tabIndex={-1} className="outline-none">
        <PortfolioPage
          sections={content.sections.map((section) => ({ ...section, visible: true }))}
          sectionOrder={content.sections.map((section) => section.type)}
          registry={rendererRegistry}
          variants={content.layout}
          customLayouts={content.customLayouts}
          context={{ identity: content.identity }}
          wrapSection={(type, section) => <PublicSectionBoundary type={type}>{section}</PublicSectionBoundary>}
        />
      </main>
      <SiteFooter footer={content.identity.footer} year={year} />
      <AnchorFocus />
      <RevealOnScroll />
    </ThemeRoot>
  );
}
