/**
 * Project cards shared by both work variants (`work-showcase.T02`; AC3–AC5, AC8, AC9): titles
 * are `h3`, metric values in the accent with muted labels, tags pinned to the bottom, and the
 * external-link arrow only for a project with a link.
 */
import type { WorkSection } from '@portfolio/contracts';

import { ArrowUpRightIcon, Card } from '../shared/index.js';

type Project = WorkSection['projects'][number];

function LinkButton({ project }: { project: Project }) {
  if (!project.link) return null;
  return (
    <a
      href={project.link}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open ${project.title} (opens in a new tab)`}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <ArrowUpRightIcon className="h-4 w-4" />
    </a>
  );
}

export function Tags({ tags }: { tags: readonly string[] }) {
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2" aria-label="Technologies">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full border border-border px-3 py-1 font-mono text-xs text-text-muted">{tag}</li>
      ))}
    </ul>
  );
}

export function FeaturedCard({ project, badge }: { project: Project; badge: string }) {
  return (
    <Card className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <span className="w-fit rounded-full bg-accent px-3 py-1 text-xs font-medium text-on-accent">{badge}</span>
          <LinkButton project={project} />
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">{project.category}</p>
        <h3 className="text-3xl font-semibold text-text">{project.title}</h3>
        <p className="whitespace-pre-line leading-relaxed text-text-muted">{project.description}</p>
        <Tags tags={project.tags} />
      </div>
      {project.metrics.length > 0 ? (
        <dl className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-[var(--radius)] border border-border bg-border">
          {project.metrics.map((metric) => (
            <div key={metric.id ?? metric.label} className="flex flex-col-reverse gap-1 bg-surface-raised p-5">
              <dt className="text-sm text-text-muted">{metric.label}</dt>
              <dd className="text-3xl font-semibold text-accent">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </Card>
  );
}

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Card className="flex h-full flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-text-muted">{project.category}</p>
        <LinkButton project={project} />
      </div>
      <h3 className="text-2xl font-semibold text-text">{project.title}</h3>
      <p className="whitespace-pre-line leading-relaxed text-text-muted">{project.description}</p>
      {project.metrics.length > 0 ? (
        <dl className="flex flex-wrap gap-6 border-t border-border pt-4">
          {project.metrics.map((metric) => (
            <div key={metric.id ?? metric.label} className="flex flex-col-reverse">
              <dt className="text-xs text-text-muted">{metric.label}</dt>
              <dd className="text-xl font-semibold text-accent">{metric.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {/* Pinned to the bottom so tag rows line up across a grid row (AC4). */}
      <div className="mt-auto">
        <Tags tags={project.tags} />
      </div>
    </Card>
  );
}
