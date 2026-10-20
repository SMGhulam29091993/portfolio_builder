/**
 * The page head for a published portfolio (`public-site-rendering.T05`; AC8, UT06): SEO title and
 * description, the canonical URL `<site>/<slug>`, Open Graph and Twitter cards (with the OG image
 * when one is published), and a JSON-LD `Person` — name, job title and social profiles, never
 * an email address.
 */
import { publicAssetPath } from '@portfolio/contracts';
import type { Metadata } from 'next';

import type { RenderableContent } from './snapshot-adapter';

/** The absolute URL of a portfolio's page. */
export function portfolioUrl(siteUrl: string, slug: string): string {
  return `${siteUrl.replace(/\/$/, '')}/${slug}`;
}

/** The absolute URL of the published OG image, or `null` when none is set and published. */
function ogImageUrl(content: RenderableContent, siteUrl: string, slug: string): string | null {
  const id = content.identity.seo.ogImageAssetId;
  const asset = id ? content.assets.find((candidate) => candidate.id === id && candidate.kind === 'image') : undefined;
  return asset ? `${siteUrl.replace(/\/$/, '')}${publicAssetPath(slug, asset)}` : null;
}

export function buildMetadata(content: RenderableContent, siteUrl: string, slug: string): Metadata {
  const { title, description } = content.identity.seo;
  const url = portfolioUrl(siteUrl, slug);
  const image = ogImageUrl(content, siteUrl, slug);
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: 'profile', title, description, url, ...(image ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, ...(image ? { images: [image] } : {}) },
  };
}

/** The structured data for search engines. Deliberately has no `email`. */
export function buildPersonJsonLd(content: RenderableContent, siteUrl: string, slug: string): Record<string, unknown> {
  const { fullName, roleTitle, socials } = content.identity;
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: fullName,
    jobTitle: roleTitle,
    url: portfolioUrl(siteUrl, slug),
    sameAs: socials.map((social) => social.url),
  };
}

/** JSON for an inline `<script>`: `<` escaped so stored text can never close the tag. */
export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
