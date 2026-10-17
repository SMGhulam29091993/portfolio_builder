/**
 * Fixture — AC9 (d): wires its own dependencies instead of receiving them from the container.
 * Expected: `portfolio/no-instantiation-outside-container` × 2 (by role suffix, by `implements`).
 */
import { BetaRepository } from './beta.repository.js';
import { InMemoryBetaStore } from './beta.store.js';

export const repository = new BetaRepository();
export const store = new InMemoryBetaStore();
