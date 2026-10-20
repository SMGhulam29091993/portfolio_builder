/** `work` · `list` — the alternate layout: every project as a full-width row, featured first. */
import type { WorkSection } from '@portfolio/contracts';

import { SectionShell, type SectionProps } from '../shared/index.js';
import { FeaturedCard, ProjectCard } from './project-card.js';

export function WorkList({ data, number }: SectionProps<WorkSection>) {
  const ordered = [...data.projects].sort((a, b) => Number(b.featured) - Number(a.featured));
  return (
    <SectionShell type="work" number={number} eyebrow={data.meta.eyebrow} heading={data.heading}>
      <ul className="flex flex-col gap-4">
        {ordered.map((project) => (
          <li key={project.id ?? project.title}>
            {project.featured ? <FeaturedCard project={project} badge={data.featuredBadge} /> : <ProjectCard project={project} />}
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}
