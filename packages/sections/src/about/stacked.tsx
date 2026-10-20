/**
 * `about` · `stacked` — the alternate layout: bio, then "Currently", stats in one row, and the
 * process steps as a list. Same payload.
 */
import type { AboutSection } from '@portfolio/contracts';

import { SectionShell, type SectionProps } from '../shared/index.js';
import { CurrentlyCard, ProcessCard, StatGrid } from './about-parts.js';

export function AboutStacked({ data, number }: SectionProps<AboutSection>) {
  return (
    <SectionShell type="about" number={number} eyebrow={data.meta.eyebrow} heading={data.heading}>
      <div className="flex max-w-3xl flex-col gap-6">
        <p className="whitespace-pre-line text-lg leading-relaxed text-text">{data.bio}</p>
        {data.currently.enabled ? <CurrentlyCard currently={data.currently} /> : null}
        <StatGrid stats={data.stats} columns={4} />
        {data.process.enabled ? <ProcessCard process={data.process} layout="list" /> : null}
      </div>
    </SectionShell>
  );
}
