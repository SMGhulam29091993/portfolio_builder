/** `stack` · `columns` — the alternate layout: groups as one column of labelled rows. */
import type { StackSection } from '@portfolio/contracts';

import { SectionShell, type SectionProps } from '../shared/index.js';
import { Chips, Credentials } from './stack-parts.js';

export function StackColumns({ data, number }: SectionProps<StackSection>) {
  return (
    <SectionShell type="stack" number={number} eyebrow={data.meta.eyebrow} heading={data.heading}>
      <ul className="flex flex-col divide-y divide-border border-y border-border">
        {data.groups.map((group) => (
          <li key={group.id ?? group.label} className="grid gap-3 py-5 md:grid-cols-[12rem_1fr]">
            <h3 className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted md:pt-1.5">{group.label}</h3>
            <Chips items={group.items} />
          </li>
        ))}
      </ul>
      <Credentials data={data} />
    </SectionShell>
  );
}
