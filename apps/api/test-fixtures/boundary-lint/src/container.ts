/**
 * Fixture: the composition root may import concrete module classes and instantiate them —
 * that is its job. Expected: no error.
 */
import { AlphaService } from './modules/alpha/alpha.service.js';
import { BetaRepository } from './modules/beta/beta.repository.js';

export const wired = { alpha: new AlphaService(), beta: new BetaRepository() };
