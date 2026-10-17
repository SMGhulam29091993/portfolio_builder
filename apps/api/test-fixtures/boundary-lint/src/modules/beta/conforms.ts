/**
 * Fixture: the legal counterpart of every violation file — must produce no `portfolio/*` error.
 *
 * - another module through its `index.ts`, and this module's own files directly (a)
 * - no framework import: this is not a `*.service.ts` file (b)
 * - configuration arrives as a parameter, never from `process.env` (c)
 * - `new` of core classes, module helpers, errors and built-ins (d)
 */
import { SystemClock, Widget } from '../../core/widget.js';
import type { AlphaReport } from '../alpha/index.js';
import { BetaBuffer, BetaNotFoundError } from './beta.helpers.js';
import type { IBetaRepository } from './beta.repository.js';

export function summarise(report: AlphaReport, repository: IBetaRepository, port: number): string {
  const buffer = new BetaBuffer();
  buffer.chunks.push(new Widget().name, String(new SystemClock().now()), String(port));
  if (!report.ok) throw new BetaNotFoundError('missing');
  return `${String(repository.count())} ${new URL('https://example.test').host} ${buffer.chunks.join()}`;
}
