/**
 * `publish-pipeline.CT01` — `IDraftContributor` for `identity` (`publish-pipeline.T02`; AC21).
 */
import { identitySchema, hasPlaceholder } from '@portfolio/contracts';
import { describe, expect, it } from 'vitest';

import { InMemoryIdentityRepository } from '../../testing/index.js';
import { IdentityDraftContributor } from './identity-draft.contributor.js';
import { IdentityService } from './identity.service.js';

const accounts = { accountOf: () => Promise.resolve({ displayName: 'Ada Lovelace', email: 'ada@example.test' }) };
const assets = { kindOf: () => Promise.resolve(null) };

describe('publish-pipeline.CT01 — IdentityDraftContributor', () => {
  it('returns the schema-valid template, placeholders included, before the first save; writes nothing', async () => {
    const repository = new InMemoryIdentityRepository();
    const contributor = new IdentityDraftContributor(new IdentityService(repository, assets, accounts));
    const identity = await contributor.collect({ portfolioId: 'p1', userId: 'u1' });
    expect(contributor.key).toBe('identity');
    expect(identitySchema.safeParse(identity).success).toBe(true);
    expect(hasPlaceholder(JSON.stringify(identity))).toBe(true);
    expect(await repository.find('p1')).toBeNull();
  });

  it('returns the stored identity once saved', async () => {
    const repository = new InMemoryIdentityRepository();
    const service = new IdentityService(repository, assets, accounts);
    const template = (await service.draft('p1', 'u1')).data;
    await repository.create('p1', { ...template, fullName: 'Ada Lovelace' });
    const identity = await new IdentityDraftContributor(service).collect({ portfolioId: 'p1', userId: 'u1' });
    expect(identity.fullName).toBe('Ada Lovelace');
  });
});
