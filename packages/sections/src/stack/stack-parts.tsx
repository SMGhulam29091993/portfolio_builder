/**
 * Pieces shared by both stack variants (`stack-credentials.T02`; AC5–AC8): chip groups with an
 * `h3` label and a list of chips, the education card (years and detail in mono on the right),
 * and certifications as nested cards — a link when they have a URL.
 */
import type { StackSection } from '@portfolio/contracts';

import { Card, CapIcon, RibbonIcon } from '../shared/index.js';

export function Chips({ items }: { items: readonly string[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item} className="rounded-full border border-border bg-surface-raised px-3 py-1 text-sm text-text">{item}</li>
      ))}
    </ul>
  );
}

const years = (start: number, end: number | null, present: string) => `${String(start)} – ${end === null ? present : String(end)}`;

export function EducationCard({ education }: { education: StackSection['education'] }) {
  return (
    <Card className="p-6">
      <h3 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
        <CapIcon className="h-4 w-4 text-accent" />
        {education.label}
      </h3>
      <ul className="divide-y divide-border">
        {education.entries.map((entry) => (
          <li key={entry.id ?? entry.title} className="flex flex-col gap-1 py-4 first:pt-0 last:pb-0 sm:flex-row sm:justify-between">
            <div>
              <p className="font-medium text-text">{entry.title}</p>
              <p className="text-sm text-text-muted">{entry.institution}</p>
            </div>
            <div className="font-mono text-sm text-text-muted sm:text-right">
              <p>{years(entry.startYear, entry.endYear, 'Present')}</p>
              {entry.detail ? <p>{entry.detail}</p> : null}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function CertificationsCard({ certifications }: { certifications: StackSection['certifications'] }) {
  return (
    <Card className="p-6">
      <h3 className="mb-4 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-text-muted">
        <RibbonIcon className="h-4 w-4 text-accent" />
        {certifications.label}
      </h3>
      <ul className="flex flex-col gap-3">
        {certifications.entries.map((entry) => {
          const body = (
            <>
              <p className="font-medium text-text">{entry.name}</p>
              <p className="text-sm text-text-muted">{entry.issuer}</p>
            </>
          );
          return (
            <li key={entry.id ?? entry.name}>
              {entry.url ? (
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${entry.name}, ${entry.issuer} (opens in a new tab)`}
                  className="block rounded-[var(--radius)] border border-border bg-surface-raised p-4 hover:border-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {body}
                </a>
              ) : (
                <div className="rounded-[var(--radius)] border border-border bg-surface-raised p-4">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Education and certifications beneath the groups; an empty or disabled list leaves no slot (AC7). */
export function Credentials({ data }: { data: StackSection }) {
  const education = data.education.enabled && data.education.entries.length > 0;
  const certifications = data.certifications.enabled && data.certifications.entries.length > 0;
  if (!education && !certifications) return null;
  return (
    <div className={`mt-4 grid gap-4 ${education && certifications ? 'lg:grid-cols-[2fr_1fr]' : ''}`}>
      {education ? <EducationCard education={data.education} /> : null}
      {certifications ? <CertificationsCard certifications={data.certifications} /> : null}
    </div>
  );
}
