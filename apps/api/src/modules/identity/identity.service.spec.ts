/**
 * `IdentityService`, the template and the asset reference provider with fakes
 * (`site-identity.UT01`, `UT02`, `UT04`, `UT05`, `UT07`; AC2, AC3, AC5, AC6, AC8, AC11).
 */
import { identitySchema, type Identity } from '@portfolio/contracts';
import { Types } from 'mongoose';
import { beforeEach, describe, expect, it } from 'vitest';

import { ValidationError } from '../../core/errors/index.js';
import { InMemoryIdentityRepository } from '../../testing/index.js';
import type { AssetKind, IAssetLookup } from '../assets/index.js';
import { IdentityAssetReferenceProvider } from './identity-asset-reference.provider.js';
import { identityTemplate, IdentityService } from './identity.service.js';

const PORTFOLIO = new Types.ObjectId().toString();
const ACCOUNT = { displayName: 'Ann Marie Lee', email: 'ann@example.test' };

class Lookup implements IAssetLookup {
  readonly kinds = new Map<string, AssetKind>();
  calls = 0;
  kindOf(_portfolioId: string, assetId: string): Promise<AssetKind | null> {
    this.calls += 1;
    return Promise.resolve(this.kinds.get(assetId) ?? null);
  }
}

let repository: InMemoryIdentityRepository;
let lookup: Lookup;
let service: IdentityService;

beforeEach(() => {
  repository = new InMemoryIdentityRepository();
  lookup = new Lookup();
  service = new IdentityService(repository, lookup, { accountOf: (id) => Promise.resolve(id === 'u1' ? ACCOUNT : null) });
});

const template = (): Identity => identityTemplate(ACCOUNT);

describe('identityTemplate (site-identity.AC11)', () => {
  it('fills name, email and initials from the account; placeholders elsewhere; valid', () => {
    const value = template();

    expect(value).toMatchObject({ fullName: 'Ann Marie Lee', email: 'ann@example.test', monogram: 'AML', roleTitle: '[Your role]' });
    expect(identitySchema.safeParse(value).success).toBe(true);
    expect(identityTemplate({ displayName: 'A B C D', email: 'x@y.test' }).monogram).toBe('AD');
    expect(identityTemplate({ displayName: '!!', email: 'x@y.test' }).monogram).toBe('ME');
  });
});

describe('IdentityService', () => {
  it('site-identity.AC11 — the draft is the template at revision 0 until saved', async () => {
    await expect(service.draft(PORTFOLIO, 'u1')).resolves.toEqual({ revision: 0, data: template() });
  });

  it('site-identity.UT01 / AC2, AC11 — revision 0 creates; then updates increment', async () => {
    await expect(service.update(PORTFOLIO, 0, template())).resolves.toMatchObject({ revision: 1 });
    const renamed = { ...template(), fullName: 'Ann Lee' };
    await expect(service.update(PORTFOLIO, 1, renamed)).resolves.toMatchObject({ revision: 2, data: { fullName: 'Ann Lee' } });
    await expect(service.draft(PORTFOLIO, 'u1')).resolves.toMatchObject({ revision: 2 });
  });

  it('site-identity.UT02 / AC3 — a stale revision (or a second create) is REVISION_CONFLICT', async () => {
    await service.update(PORTFOLIO, 0, template());

    await expect(service.update(PORTFOLIO, 0, template())).rejects.toMatchObject({ code: 'REVISION_CONFLICT', details: { currentRevision: 1 } });
    await expect(service.update(PORTFOLIO, 7, template())).rejects.toMatchObject({ code: 'REVISION_CONFLICT', details: { currentRevision: 1 } });
  });

  it('site-identity.UT04 / AC5 — a missing asset or the wrong kind is 400 at each path', async () => {
    lookup.kinds.set('img', 'image');
    const data = { ...template(), resume: { assetId: 'img', label: 'CV' }, seo: { ...template().seo, ogImageAssetId: 'missing' } };

    const error = await service.update(PORTFOLIO, 0, data).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect((error as ValidationError).details.errors).toEqual([
      { path: 'resume.assetId', message: 'Choose an uploaded résumé PDF' },
      { path: 'seo.ogImageAssetId', message: 'Choose an uploaded image' },
    ]);
  });

  it('site-identity.UT05 / AC6 — null asset ids skip the lookup', async () => {
    await service.update(PORTFOLIO, 0, template());

    expect(lookup.calls).toBe(0);
  });

  it('accepts a real résumé and image', async () => {
    lookup.kinds.set('pdf', 'resume');
    lookup.kinds.set('png', 'image');

    await expect(
      service.update(PORTFOLIO, 0, { ...template(), resume: { assetId: 'pdf', label: 'CV' }, seo: { ...template().seo, ogImageAssetId: 'png' } }),
    ).resolves.toMatchObject({ revision: 1 });
  });
});

describe('IdentityAssetReferenceProvider (site-identity.UT07 / AC8)', () => {
  it('reports the résumé and the OG image as in use, nothing else', async () => {
    lookup.kinds.set('pdf', 'resume');
    lookup.kinds.set('png', 'image');
    await service.update(PORTFOLIO, 0, { ...template(), resume: { assetId: 'pdf', label: 'CV' }, seo: { ...template().seo, ogImageAssetId: 'png' } });
    const provider = new IdentityAssetReferenceProvider(repository);

    await expect(provider.referencesAsset('pdf', PORTFOLIO)).resolves.toBe(true);
    await expect(provider.referencesAsset('png', PORTFOLIO)).resolves.toBe(true);
    await expect(provider.referencesAsset('other', PORTFOLIO)).resolves.toBe(false);
    await expect(provider.referencesAsset('pdf', new Types.ObjectId().toString())).resolves.toBe(false);
  });
});
