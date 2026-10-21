/** `/sitemap.xml` (`public-site-rendering.AC9`): the platform home and every published portfolio. */
import type { MetadataRoute } from 'next';

import { loadEnv } from '../lib/env';
import { publishedSource } from '../lib/site/published';
import { portfolioUrl } from '../lib/site/site-metadata';

/** Re-read at most every 300 seconds; a publish expires it at once through the list's tag. */
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = loadEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const portfolios = await publishedSource().publishedSlugs();
  return [
    { url: `${site}/` },
    ...portfolios.map(({ slug, publishedAt }) => ({ url: portfolioUrl(site, slug), lastModified: publishedAt })),
  ];
}
