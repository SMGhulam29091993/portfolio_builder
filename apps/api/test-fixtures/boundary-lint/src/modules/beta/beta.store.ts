/**
 * Fixture: an adapter of module `beta`. Its name carries no role suffix, so the instantiation rule
 * must recognise it from its `implements` clause.
 */
export interface IBetaStore {
  has(key: string): boolean;
}

export class InMemoryBetaStore implements IBetaStore {
  has(key: string): boolean {
    return key.length > 0;
  }
}
