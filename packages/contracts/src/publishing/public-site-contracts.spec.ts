/** Public-site contracts (`public-site-rendering`). */
import { describe, expect, it } from 'vitest';

import { isPortfolioSlug, publicAssetParamsSchema, publicAssetPath } from './public-site-contracts.js';

describe('public-site contracts', () => {
  it('accepts portfolio slugs and refuses reserved or malformed ones', () => {
    expect(isPortfolioSlug('ada-lovelace')).toBe(true);
    expect(isPortfolioSlug('cms')).toBe(false);
    expect(isPortfolioSlug('Ada')).toBe(false);
    expect(isPortfolioSlug('a')).toBe(false);
  });

  it('builds the asset URL with every part encoded', () => {
    expect(publicAssetPath('ada', { id: 'abc', filename: 'My CV.pdf' })).toBe('/api/v1/public/portfolios/ada/assets/abc/My%20CV.pdf');
  });

  it('validates asset params', () => {
    expect(publicAssetParamsSchema.safeParse({ slug: 'ada', id: 'x', filename: 'cv.pdf' }).success).toBe(true);
    expect(publicAssetParamsSchema.safeParse({ slug: 'ada', id: '', filename: 'cv.pdf' }).success).toBe(false);
  });
});
