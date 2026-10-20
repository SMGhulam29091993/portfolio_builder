/**
 * `experience` · `timeline` — the reference layout (`experience-timeline.T02`; AC3–AC7): dates and
 * city right-aligned in a left column, a marker on a continuous line, then company, role and
 * highlights; at 390 the line sits at the left edge and the dates move above the company. The
 * current role's marker is the accent with a glow (when the theme's glow is on).
 */
import type { ExperienceSection } from '@portfolio/contracts';

import { SectionShell, type SectionProps } from '../shared/index.js';
import { DateRange, Highlights } from './date-range.js';
import { orderEntries } from './dates.js';

export function ExperienceTimeline({ data, number }: SectionProps<ExperienceSection>) {
  return (
    <SectionShell type="experience" number={number} eyebrow={data.meta.eyebrow} heading={data.heading}>
      <ol className="relative flex flex-col gap-12 border-l border-border pl-8 md:ml-[13rem] md:pl-10">
        {orderEntries(data.entries).map((entry) => (
          <li key={entry.id ?? entry.company} className="relative">
            <span
              aria-hidden="true"
              className={`absolute top-2 -left-[2.4rem] h-3 w-3 rounded-full md:-left-[2.9rem] ${entry.end === null ? 'bg-accent' : 'bg-text-muted'}`}
            >
              {entry.end === null ? <span data-effect="glow" className="absolute inset-0 rounded-full bg-accent blur-md" /> : null}
            </span>
            <p className="mb-2 font-mono text-sm text-text-muted md:absolute md:top-0 md:-left-[16rem] md:w-48 md:text-right">
              <DateRange entry={entry} presentLabel={data.presentLabel} />
              {entry.location ? <span className="block">{entry.location}</span> : null}
            </p>
            <h3 className="text-2xl font-semibold text-text">{entry.company}</h3>
            <p className="mb-4 text-accent">{entry.role}</p>
            <Highlights highlights={entry.highlights} />
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
