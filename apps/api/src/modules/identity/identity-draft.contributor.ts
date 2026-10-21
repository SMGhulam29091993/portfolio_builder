/**
 * Contributes the identity to a publish (`publish-pipeline.T02`). Implements `IDraftContributor`
 * owned by `publishing` (ADR-0013). Before the first save this is the account's template — still
 * holding its `[Your …]` placeholders, which `no-placeholder-text` then blocks (AC21). Read-only.
 */
import type { DraftScope, IDraftContributor } from '../publishing/index.js';
import type { IIdentityService } from './identity.interface.js';
import type { Identity } from './identity.types.js';

export class IdentityDraftContributor implements IDraftContributor<'identity'> {
  readonly key = 'identity' as const;

  constructor(private readonly identities: Pick<IIdentityService, 'draft'>) {}

  async collect({ portfolioId, userId }: DraftScope): Promise<Identity> {
    return (await this.identities.draft(portfolioId, userId)).data;
  }
}
