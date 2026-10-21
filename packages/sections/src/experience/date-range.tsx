/** A role's date range with machine-readable `<time>` values (`experience-timeline.AC4`, `AC7`). */
import type { ExperienceSection } from '@portfolio/contracts';

import { formatMonth, machineMonth } from './dates.js';

type Entry = ExperienceSection['entries'][number];

export function DateRange({ entry, presentLabel }: { entry: Entry; presentLabel: string }) {
  return (
    <span>
      <time dateTime={machineMonth(entry.start)}>{formatMonth(entry.start)}</time> —{' '}
      {entry.end ? <time dateTime={machineMonth(entry.end)}>{formatMonth(entry.end)}</time> : presentLabel}
    </span>
  );
}

export function Highlights({ highlights }: { highlights: readonly string[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {highlights.map((highlight, position) => (
        <li key={`${String(position)}-${highlight.slice(0, 16)}`} className="flex gap-3 text-text-muted">
          <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
          <span>{highlight}</span>
        </li>
      ))}
    </ul>
  );
}
