/**
 * `IIdentityService` — one portfolio's identity (`site-identity.T03`; API01–API02; ADR-0010).
 *
 * With nothing stored, the draft is the template built from the account: name and email from
 * the account, the monogram from the name's initials, bracketed placeholders elsewhere, at
 * revision 0 (`site-identity.AC11`); the first save creates the document. Asset ids are checked
 * through `IAssetLookup` within the same portfolio (`AC5`); a lookup failure propagates as a
 * 500, never as "missing" (Error Handling). Every failing asset path is reported in one 400.
 * Email is PII: nothing here logs.
 */
import { ConflictError, NotFoundError, ValidationError, type ValidationIssue } from '../../core/errors/index.js';
import type { IAssetLookup } from '../assets/index.js';
import type { IIdentityAccounts, IIdentityRepository, IIdentityService } from './identity.interface.js';
import type { CmsIdentity, Identity, IdentityAccount, StoredIdentity } from './identity.types.js';

export class IdentityService implements IIdentityService {
  constructor(
    private readonly identities: IIdentityRepository,
    private readonly assets: IAssetLookup,
    private readonly accounts: IIdentityAccounts,
  ) {}

  read(portfolioId: string): Promise<StoredIdentity | null> {
    return this.identities.find(portfolioId);
  }

  async draft(portfolioId: string, userId: string): Promise<CmsIdentity> {
    const stored = await this.identities.find(portfolioId);
    if (stored) return toCms(stored);
    const account = await this.accounts.accountOf(userId);
    if (!account) throw new NotFoundError('Account not found');
    return { revision: 0, data: identityTemplate(account) };
  }

  async update(portfolioId: string, expectedRevision: number, data: Identity): Promise<CmsIdentity> {
    await this.checkAssets(portfolioId, data);
    if (expectedRevision === 0) {
      try {
        return toCms(await this.identities.create(portfolioId, data));
      } catch (error) {
        if (error instanceof ConflictError && error.code === 'IDENTITY_EXISTS') throw await this.conflict(portfolioId);
        throw error;
      }
    }
    const updated = await this.identities.update(portfolioId, expectedRevision, data);
    if (!updated) throw await this.conflict(portfolioId);
    return toCms(updated);
  }

  /** `resume.assetId` must be a `resume`, `seo.ogImageAssetId` an `image`, both of this portfolio. */
  private async checkAssets(portfolioId: string, data: Identity): Promise<void> {
    const checks: [string, string | null, 'resume' | 'image'][] = [
      ['resume.assetId', data.resume.assetId, 'resume'],
      ['seo.ogImageAssetId', data.seo.ogImageAssetId, 'image'],
    ];
    const issues: ValidationIssue[] = [];
    for (const [path, assetId, kind] of checks) {
      if (assetId === null) continue;
      const found = await this.assets.kindOf(portfolioId, assetId);
      if (found !== kind) issues.push({ path, message: `Choose an uploaded ${kind === 'resume' ? 'résumé PDF' : 'image'}` });
    }
    if (issues.length > 0) throw new ValidationError(issues);
  }

  private async conflict(portfolioId: string): Promise<ConflictError> {
    const current = await this.identities.find(portfolioId);
    return new ConflictError(
      'REVISION_CONFLICT',
      { currentRevision: current?.revision ?? 0 },
      'This was changed elsewhere. Reload to see the latest version',
    );
  }
}

function toCms(stored: StoredIdentity): CmsIdentity {
  return { revision: stored.revision, updatedAt: stored.updatedAt.toISOString(), data: stored.data };
}

/**
 * The template identity for a new portfolio (`site-identity.AC11`; `section-engine` → Portfolio
 * provisioning: placeholders in square brackets, blocked from publishing until replaced).
 */
export function identityTemplate({ displayName, email }: IdentityAccount): Identity {
  const initials = displayName
    .split(/\s+/)
    .map((word) => word.replace(/[^A-Za-z0-9]/g, '').charAt(0))
    .filter(Boolean)
    .join('')
    .toUpperCase();
  const monogram = (initials.length > 3 ? `${initials.charAt(0)}${initials.charAt(initials.length - 1)}` : initials) || 'ME';
  return {
    fullName: displayName,
    monogram,
    roleTitle: '[Your role]',
    email,
    location: { label: '[Your city, country]' },
    availability: { enabled: false, label: '[Open to new roles]' },
    socials: [],
    resume: { assetId: null, label: 'Résumé' },
    footer: { copyrightName: displayName, builtWith: [] },
    seo: { title: `${displayName} — [Your role]`.slice(0, 70), description: '[One sentence about what you do]', ogImageAssetId: null },
  };
}
