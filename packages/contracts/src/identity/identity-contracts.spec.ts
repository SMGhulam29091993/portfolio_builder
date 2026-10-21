/** `identitySchema` — `site-identity.UT03`, `UT06` (AC4, AC7) and the data variations. */
import { describe, expect, it } from 'vitest';

import { identitySchema } from './identity-contracts.js';

const VALID = {
  fullName: 'Ann Lee',
  monogram: 'AL',
  roleTitle: 'Engineer',
  email: 'Ann@Example.TEST',
  location: { label: 'Kolkata, India', timezoneLabel: 'IST (UTC+5:30)' },
  availability: { enabled: true, label: 'Open to roles' },
  socials: [{ id: 's1', platform: 'github', url: 'https://github.com/x' }],
  resume: { assetId: null, label: 'Résumé' },
  footer: { copyrightName: 'Ann Lee', builtWith: ['Next.js'] },
  seo: { title: 'Ann Lee — Engineer', description: 'Builds things.', ogImageAssetId: null },
};

describe('identitySchema', () => {
  it('lower-cases the email and accepts a valid identity', () => {
    expect(identitySchema.parse(VALID).email).toBe('ann@example.test');
  });

  it.each(['G', 'GF', 'GF1'])('accepts the monogram %s', (monogram) => {
    expect(identitySchema.safeParse({ ...VALID, monogram }).success).toBe(true);
  });

  it('site-identity.UT03 / AC4 — reports each failing path', () => {
    const result = identitySchema.safeParse({
      ...VALID,
      email: 'not-an-email',
      monogram: 'gf',
      socials: [
        { platform: 'github', url: 'http://github.com/x' },
        { platform: 'github', url: 'https://github.com/y' },
      ],
    });

    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.')).sort();
    expect(paths).toEqual(['email', 'monogram', 'socials.0.url', 'socials.1.platform']);
  });

  it.each(['GFXY', '', 'g'])('rejects the monogram %j', (monogram) => {
    expect(identitySchema.safeParse({ ...VALID, monogram }).success).toBe(false);
  });

  it('site-identity.UT06 / AC7 — strips phone and other unknown keys', () => {
    const parsed = identitySchema.parse({ ...VALID, phone: '+91 00000 00000', extra: 1 });

    expect(parsed).not.toHaveProperty('phone');
    expect(parsed).not.toHaveProperty('extra');
  });

  it('allows no socials and at most six', () => {
    expect(identitySchema.safeParse({ ...VALID, socials: [] }).success).toBe(true);
    expect(identitySchema.safeParse({ ...VALID, footer: { ...VALID.footer, builtWith: Array(7).fill('x') } }).success).toBe(false);
  });
});
