/** Fixture: a test file may construct the class under test directly. Expected: no error. */
import { BetaRepository } from './beta.repository.js';

export const subject = new BetaRepository();
