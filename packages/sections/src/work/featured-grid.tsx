/**
 * `work` · `featured-grid` — the reference layout (`work-showcase.T02`; AC3, AC4, AC6, AC7): the
 * featured project full width, then the others in a three-column grid whose last row stays
 * left-aligned; one column at 390.
 */
import type { WorkSection } from '@portfolio/contracts';

import { SectionShell, type SectionProps } from '../shared/index.js';
import { FeaturedCard, ProjectCard } from './project-card.js';

export function WorkFeaturedGrid({ data, number }: SectionProps<WorkSection>) {
  const featured = data.projects.find((project) => project.featured);
  const others = data.projects.filter((project) => !project.featured);
  return (
    <SectionShell type="work" number={number} eyebrow={data.meta.eyebrow} heading={data.heading}>
      <div className="flex flex-col gap-4">
        {featured ? <FeaturedCard project={featured} badge={data.featuredBadge} /> : null}
        {others.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {others.map((project) => (
              <li key={project.id ?? project.title}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </SectionShell>
  );
}
