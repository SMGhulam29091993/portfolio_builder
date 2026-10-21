/**
 * Domain types of the `identity` module (`site-identity` plan → Data Model). The `Identity`
 * shape is owned by `packages/contracts` and re-exported here.
 */
import type { Identity } from '@portfolio/contracts';

export {
  identitySchema,
  updateIdentityRequestSchema,
  type CmsIdentity,
  type Identity,
  type UpdateIdentityRequest,
} from '@portfolio/contracts';

/** One portfolio's stored identity (ADR-0010: one per portfolio). */
export interface StoredIdentity {
  readonly portfolioId: string;
  readonly revision: number;
  readonly data: Identity;
  readonly updatedAt: Date;
}

/** What the template needs from the account (`site-identity.AC11`). */
export interface IdentityAccount {
  readonly displayName: string;
  readonly email: string;
}
