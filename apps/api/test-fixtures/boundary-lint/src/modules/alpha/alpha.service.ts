/** Fixture: a service class of module `alpha`. Reachable from other modules only through types. */
import type { AlphaReport } from './alpha.types.js';

export interface IAlphaService {
  report(): AlphaReport;
}

export class AlphaService implements IAlphaService {
  report(): AlphaReport {
    return { ok: true };
  }
}
