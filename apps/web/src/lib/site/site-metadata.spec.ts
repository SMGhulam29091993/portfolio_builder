/** Page metadata and structured data (`public-site-rendering.UT06`; AC8). */
import { describe, expect, it } from 'vitest';

import { buildMetadata, buildPersonJsonLd, serializeJsonLd } from './site-metadata';
import { publicPortfolioFixture } from './site-fixtures';
import { adaptSnapshot } from './snapshot-adapter';

const content = adaptSnapshot(publicPortfolioFixture().content);

describe('site metadata', () => {
  it('SEO title and description, canonical URL by slug, OG and Twitter with the published image', () => {
    const metadata = buildMetadata(content, 'https://folio.test/', 'ada');
    expect(metadata).toMatchObject({
      title: 'Ada Lovelace — Analyst',
      description: 'Notes on engines.',
      alternates: { canonical: 'https://folio.test/ada' },
      openGraph: { url: 'https://folio.test/ada', images: [{ url: 'https://folio.test/api/v1/public/portfolios/ada/assets/i1/og.png' }] },
      twitter: { card: 'summary_large_image' },
    });
  });

  it('no image tags without a published OG image', () => {
    const metadata = buildMetadata({ ...content, assets: [] }, 'https://folio.test', 'ada');
    expect(metadata.openGraph).not.toHaveProperty('images');
    expect(metadata.twitter).toMatchObject({ card: 'summary' });
  });

  it('JSON-LD Person: name, job title, sameAs — and no email', () => {
    const ld = buildPersonJsonLd(content, 'https://folio.test', 'ada');
    expect(ld).toEqual({
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: 'Ada Lovelace',
      jobTitle: 'Analyst',
      url: 'https://folio.test/ada',
      sameAs: ['https://github.com/ada'],
    });
    expect(JSON.stringify(ld)).not.toContain('ada@example.test');
  });

  it('escapes < so stored text cannot close the script tag', () => {
    expect(serializeJsonLd({ name: '</script><b>' })).toBe('{"name":"\\u003c/script>\\u003cb>"}');
  });
});
