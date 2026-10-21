/** In-memory fake of `IIdentityRepository` for service tests (same rules as the real one). */
import { ConflictError } from '../../core/errors/index.js';
import type { Identity, IIdentityRepository, StoredIdentity } from '../../modules/identity/index.js';

export class InMemoryIdentityRepository implements IIdentityRepository {
  private readonly stored = new Map<string, StoredIdentity>();

  find(portfolioId: string): Promise<StoredIdentity | null> {
    const found = this.stored.get(portfolioId);
    return Promise.resolve(found ? structuredClone(found) : null);
  }

  // eslint-disable-next-line @typescript-eslint/require-await -- async so conflicts reject.
  async create(portfolioId: string, data: Identity): Promise<StoredIdentity> {
    if (this.stored.has(portfolioId)) throw new ConflictError('IDENTITY_EXISTS', {}, 'The identity already exists');
    const created = { portfolioId, revision: 1, data: structuredClone(data), updatedAt: new Date() };
    this.stored.set(portfolioId, created);
    return structuredClone(created);
  }

  update(portfolioId: string, expectedRevision: number, data: Identity): Promise<StoredIdentity | null> {
    const current = this.stored.get(portfolioId);
    if (current?.revision !== expectedRevision) return Promise.resolve(null);
    const updated = { ...current, revision: current.revision + 1, data: structuredClone(data), updatedAt: new Date() };
    this.stored.set(portfolioId, updated);
    return Promise.resolve(structuredClone(updated));
  }
}
