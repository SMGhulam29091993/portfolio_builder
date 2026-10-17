/**
 * Fixture — AC9 (a): reaches into module `alpha` past its `index.ts` in all three import forms.
 * Expected: `portfolio/module-boundary` × 3.
 */
import type { AlphaReport } from '../alpha/alpha.types.js';

export type { IAlphaService } from '../alpha/alpha.service.js';

export async function loadAlpha(): Promise<unknown> {
  return import('../alpha/alpha.service.js');
}

export type BetaView = AlphaReport;
