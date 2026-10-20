/**
 * Date rules of the experience section (`experience-timeline.AC3`, `AC4`). Pure, so they are
 * unit-tested: current roles first, then by start descending, ties in list order; ranges read
 * `<Mon> <YYYY> — <Mon> <YYYY>` with the reference abbreviations (`Sept`).
 */
import type { ExperienceSection, YearMonth } from '@portfolio/contracts';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];

type Entry = ExperienceSection['entries'][number];

const index = (value: YearMonth) => value.year * 12 + value.month;

export function orderEntries(entries: readonly Entry[]): Entry[] {
  return entries
    .map((entry, position) => ({ entry, position }))
    .sort((a, b) => {
      const current = Number(b.entry.end === null) - Number(a.entry.end === null);
      if (current !== 0) return current;
      return index(b.entry.start) - index(a.entry.start) || a.position - b.position;
    })
    .map(({ entry }) => entry);
}

export function formatMonth(value: YearMonth): string {
  return `${MONTHS[value.month - 1] ?? ''} ${String(value.year)}`;
}

/** `YYYY-MM` for `<time dateTime>`. */
export function machineMonth(value: YearMonth): string {
  return `${String(value.year)}-${String(value.month).padStart(2, '0')}`;
}
