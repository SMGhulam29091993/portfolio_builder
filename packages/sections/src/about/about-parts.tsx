/**
 * The about section's cards, shared by both variants (`about-section.T03`; AC5–AC7): the stat
 * grid that never leaves an empty slot, and the process card whose step numbers are derived
 * from position.
 */
import type { AboutSection } from '@portfolio/contracts';

import { Card, SparkleIcon } from '../shared/index.js';

export function CurrentlyCard({ currently }: { currently: AboutSection['currently'] }) {
  return (
    <Card className="flex flex-col justify-between gap-6 p-6">
      <SparkleIcon className="h-6 w-6 text-accent" />
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">{currently.label}</p>
        <p className="mt-2 text-lg text-text">{currently.text}</p>
      </div>
    </Card>
  );
}

export function StatGrid({ stats, columns }: { stats: AboutSection['stats']; columns: 2 | 4 }) {
  if (stats.length === 0) return null;
  return (
    // `auto-fit` lets 1–3 stats share the row's width: no empty placeholder card (AC5).
    <ul className={`grid gap-4 ${columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]'}`}>
      {stats.map((stat) => (
        <li key={stat.id ?? stat.label}>
          <Card className="h-full p-6">
            <p className="text-4xl font-semibold text-text">{stat.value}</p>
            <p className="mt-2 text-sm text-text-muted">{stat.label}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function ProcessCard({ process, layout }: { process: AboutSection['process']; layout: 'row' | 'list' }) {
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-accent">{process.eyebrow}</p>
          <h3 className="mt-2 text-2xl font-semibold text-text">{process.title}</h3>
        </div>
        {process.note ? <p className="max-w-sm text-sm text-text-muted">{process.note}</p> : null}
      </div>
      <ol className={`mt-8 grid gap-6 ${layout === 'row' ? 'md:grid-cols-[repeat(auto-fit,minmax(10rem,1fr))]' : ''}`}>
        {process.steps.map((step, index) => (
          <li key={step.id ?? step.title} className="flex flex-col gap-2">
            <span className="font-mono text-sm text-accent">{String(index + 1).padStart(2, '0')}</span>
            <h4 className="font-medium text-text">{step.title}</h4>
            <p className="text-sm text-text-muted">{step.description}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
