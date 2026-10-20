/** `/robots.txt` (`public-site-rendering.AC9`): the site is public; the CMS and the API are not. */
import type { MetadataRoute } from 'next';

import { loadEnv } from '../lib/env';

export default function robots(): MetadataRoute.Robots {
  const site = loadEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/cms', '/api'] },
    sitemap: `${site}/sitemap.xml`,
  };
}
