/**
 * What every section renderer receives besides its own data (`int-standards.nextjs.md` →
 * Components: props in): the portfolio's identity, so the hero, contact card and nav read one
 * set of values (`site-identity`). `null` when the portfolio has no identity yet.
 */
import type { Identity } from '@portfolio/contracts';

import type { SectionRendererProps } from '../registry.js';

export interface SectionContext {
  readonly identity: Identity | null;
}

/** Props of a section renderer. */
export type SectionProps<Data> = SectionRendererProps<Data, SectionContext>;
