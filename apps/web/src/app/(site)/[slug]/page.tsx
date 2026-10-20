/**
 * `/<slug>` — a published portfolio (`public-site-rendering.T02`, `T05`, `T08`). Rendered on the
 * server from the live snapshot; cached per slug and refreshed by the revalidate route, or after
 * 300 seconds at the latest (AC11). Not published (or no such portfolio) is the 404 page;
 * an unreachable API with no earlier render, or a snapshot version this build cannot read, is
 * the error page (AC16, AC17).
 */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { SitePage } from '../../../components/site/site-page';
import { loadEnv } from '../../../lib/env';
import { readPublished } from '../../../lib/site/published';
import { buildMetadata, buildPersonJsonLd, serializeJsonLd } from '../../../lib/site/site-metadata';
import { adaptSnapshot, UnsupportedSnapshotVersionError, type RenderableContent } from '../../../lib/site/snapshot-adapter';

/** The time-based fallback (`PORTFOLIO_FALLBACK_SECONDS`); a literal because Next reads it statically. */
export const revalidate = 300;

interface Props {
  readonly params: Promise<{ slug: string }>;
}

/** The published content, adapted; `notFound()` when there is none. */
async function load(slug: string): Promise<RenderableContent> {
  const result = await readPublished(slug);
  if (result.kind === 'not-published') notFound();
  if (result.kind === 'unavailable') throw new Error('The portfolio API is unreachable');
  try {
    return adaptSnapshot(result.portfolio.content);
  } catch (error) {
    if (error instanceof UnsupportedSnapshotVersionError) {
      console.error(`public site: unsupported snapshot schemaVersion ${String(error.version)}`);
    }
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return buildMetadata(await load(slug), loadEnv().NEXT_PUBLIC_SITE_URL, slug);
}

export default async function PortfolioRoute({ params }: Props) {
  const { slug } = await params;
  const content = await load(slug);
  const jsonLd = serializeJsonLd(buildPersonJsonLd(content, loadEnv().NEXT_PUBLIC_SITE_URL, slug));
  return (
    <>
      {/* Structured data is JSON, escaped by `serializeJsonLd`; this is the documented way to emit it. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SitePage slug={slug} content={content} year={new Date().getFullYear()} />
    </>
  );
}
