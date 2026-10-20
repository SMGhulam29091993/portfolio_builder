/** A published portfolio for the site's unit tests. */
import type { PublicPortfolio } from '@portfolio/contracts';
import { DEFAULT_DESIGN } from '@portfolio/design-tokens';

export function publicPortfolioFixture(): PublicPortfolio {
  return {
    slug: 'ada',
    version: 2,
    publishedAt: '2026-10-21T00:00:00.000Z',
    content: {
      schemaVersion: 1,
      identity: {
        fullName: 'Ada Lovelace',
        monogram: 'AL',
        roleTitle: 'Analyst',
        email: 'ada@example.test',
        location: { label: 'London' },
        availability: { enabled: true, label: 'Open to work' },
        socials: [{ platform: 'github', url: 'https://github.com/ada' }],
        resume: { assetId: 'r1', label: 'Résumé' },
        footer: { copyrightName: 'Ada Lovelace', builtWith: ['Next.js'] },
        seo: { title: 'Ada Lovelace — Analyst', description: 'Notes on engines.', ogImageAssetId: 'i1' },
      },
      sections: [{ type: 'hero', data: {} }],
      design: { theme: DEFAULT_DESIGN.theme, layout: { ...DEFAULT_DESIGN.layout } },
      assets: [
        { id: 'r1', kind: 'resume', filename: 'cv.pdf', mime: 'application/pdf', sizeBytes: 1, sha256: 'a'.repeat(64) },
        { id: 'i1', kind: 'image', filename: 'og.png', mime: 'image/png', sizeBytes: 1, sha256: 'b'.repeat(64) },
      ],
    },
  };
}
