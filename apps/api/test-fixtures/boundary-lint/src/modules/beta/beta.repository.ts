/** Fixture: a repository class of module `beta`; constructible only in the container or tests. */
export interface IBetaRepository {
  count(): number;
}

export class BetaRepository implements IBetaRepository {
  count(): number {
    return 0;
  }
}
