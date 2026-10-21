/**
 * Contracts of the `identity` module, owned on the consuming side and role-sized.
 */
import type { CmsIdentity, Identity, IdentityAccount, StoredIdentity } from './identity.types.js';

/** The `identities` collection; scoped by `portfolioId`. */
export interface IIdentityRepository {
  find(portfolioId: string): Promise<StoredIdentity | null>;
  /**
   * Stores the first identity at revision 1.
   *
   * @throws {ConflictError} `IDENTITY_EXISTS` — this portfolio already has one.
   */
  create(portfolioId: string, data: Identity): Promise<StoredIdentity>;
  /** @returns `null` when the revision did not match. */
  update(portfolioId: string, expectedRevision: number, data: Identity): Promise<StoredIdentity | null>;
}

/**
 * The account's display name and email, for the template. The container adapts `auth`'s user
 * reader to it, so `identity` imports nothing from `auth` for this.
 */
export interface IIdentityAccounts {
  accountOf(userId: string): Promise<IdentityAccount | null>;
}

/** Read access for other modules (`publish-pipeline` contributes it to the snapshot). */
export interface IIdentityReader {
  /** The stored identity, or `null` when the portfolio has none yet. */
  read(portfolioId: string): Promise<StoredIdentity | null>;
}

/** `site-identity.API01`–`API02`. */
export interface IIdentityService extends IIdentityReader {
  /** The stored identity, or the account's template at revision 0. */
  draft(portfolioId: string, userId: string): Promise<CmsIdentity>;
  /**
   * @throws {ValidationError} An asset id is unknown or of the wrong kind.
   * @throws {ConflictError} `REVISION_CONFLICT` with `currentRevision`.
   */
  update(portfolioId: string, expectedRevision: number, data: Identity): Promise<CmsIdentity>;
}
