/**
 * `stack` · `chip-groups` — the reference layout (`stack-credentials.T02`; AC3, AC4): a
 * three-column grid of group cards, then education (two thirds) and certifications (one third);
 * one column at 390, education first.
 */
import type { StackSection } from '@portfolio/contracts';

import { Card, SectionShell, type SectionProps } from '../shared/index.js';
import { Chips, Credentials } from './stack-parts.js';

export function StackChipGroups({ data, number }: SectionProps<StackSection>) {
  return (
    <SectionShell type="stack" number={number} eyebrow={data.meta.eyebrow} heading={data.heading}>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.groups.map((group) => (
          <li key={group.id ?? group.label}>
            <Card className="h-full p-6">
              <h3 className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-text-muted">{group.label}</h3>
              <Chips items={group.items} />
            </Card>
          </li>
        ))}
      </ul>
      <Credentials data={data} />
    </SectionShell>
  );
}
