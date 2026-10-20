/** `experience` · `cards` — the alternate layout: one card per role in a two-column grid. */
import type { ExperienceSection } from '@portfolio/contracts';

import { Card, SectionShell, type SectionProps } from '../shared/index.js';
import { DateRange, Highlights } from './date-range.js';
import { orderEntries } from './dates.js';

export function ExperienceCards({ data, number }: SectionProps<ExperienceSection>) {
  return (
    <SectionShell type="experience" number={number} eyebrow={data.meta.eyebrow} heading={data.heading}>
      <ol className="grid gap-4 md:grid-cols-2">
        {orderEntries(data.entries).map((entry) => (
          <li key={entry.id ?? entry.company}>
            <Card className="flex h-full flex-col gap-3 p-6">
              <p className="font-mono text-sm text-text-muted">
                <DateRange entry={entry} presentLabel={data.presentLabel} />
                {entry.location ? ` · ${entry.location}` : ''}
              </p>
              <h3 className="text-2xl font-semibold text-text">{entry.company}</h3>
              <p className="text-accent">{entry.role}</p>
              <Highlights highlights={entry.highlights} />
            </Card>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
