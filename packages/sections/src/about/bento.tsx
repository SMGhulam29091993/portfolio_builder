/**
 * `about` · `bento` — the reference layout (`about-section.T03`; AC3–AC7): bio and the narrower
 * "Currently" card share the first row, stats in a 2 × 2 grid beneath, the process card full
 * width with its steps in one row; everything stacks in reading order at 390.
 */
import type { AboutSection } from '@portfolio/contracts';

import { Card, SectionShell, type SectionProps } from '../shared/index.js';
import { CurrentlyCard, ProcessCard, StatGrid } from './about-parts.js';

export function AboutBento({ data, number }: SectionProps<AboutSection>) {
  return (
    <SectionShell type="about" number={number} eyebrow={data.meta.eyebrow} heading={data.heading}>
      <div className="flex flex-col gap-4">
        <div className={`grid gap-4 ${data.currently.enabled ? 'lg:grid-cols-[2fr_1fr]' : ''}`}>
          <Card className="p-6 sm:p-8">
            <p className="whitespace-pre-line text-lg leading-relaxed text-text">{data.bio}</p>
          </Card>
          {data.currently.enabled ? <CurrentlyCard currently={data.currently} /> : null}
        </div>
        <StatGrid stats={data.stats} columns={2} />
        {data.process.enabled ? <ProcessCard process={data.process} layout="row" /> : null}
      </div>
    </SectionShell>
  );
}
