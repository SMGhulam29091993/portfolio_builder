/**
 * `CustomLayoutRenderer` (`design-library.T02`; AC3; ADR-0014): draws a section from a custom
 * layout — the section's existing blocks, in the stacks and columns the layout names. Every block
 * is a component the catalogue variants already use, so a custom layout changes arrangement, never
 * the look of a block, and nothing from the layout is rendered as markup.
 *
 * The section frame stays the section's own: `SectionShell` (eyebrow, number, heading, aligned as
 * the layout says), or for the hero its backdrop and marquee. Columns stack on phones.
 */
import type { AboutSection, ContactSection, EmphasisHeading, ExperienceSection, HeroSection, StackSection, WorkSection } from '@portfolio/contracts';
import type { CustomLayout, LayoutBlock, LayoutColumns, LayoutGap, LayoutInner } from '@portfolio/design-tokens';
import type { ReactNode } from 'react';

import { CurrentlyCard, ProcessCard, StatGrid } from '../about/about-parts.js';
import { ContactActions } from '../contact/contact-parts.js';
import { JobCards } from '../experience/cards.js';
import { TimelineEntries } from '../experience/timeline.js';
import { CodeCard } from '../hero/code-card.js';
import { HeroContent } from '../hero/hero-content.js';
import { Card, CONTAINER, DotGrid, Glow, Marquee, SectionShell, type SectionProps } from '../shared/index.js';
import { SkillCards } from '../stack/chip-groups.js';
import { SkillRows } from '../stack/columns.js';
import { Credentials } from '../stack/stack-parts.js';
import { FeaturedCard, ProjectCard } from '../work/project-card.js';

/** Fixed class strings, so Tailwind sees every one in the source. */
const GAPS: Readonly<Record<LayoutGap, string>> = { sm: 'gap-4', md: 'gap-6', lg: 'gap-10' };
const COLUMNS: Readonly<Record<LayoutColumns, string>> = {
  '1-1': 'md:grid-cols-2',
  '2-1': 'md:grid-cols-[2fr_1fr]',
  '1-2': 'md:grid-cols-[1fr_2fr]',
  '1-1-1': 'md:grid-cols-2 lg:grid-cols-3',
};

/** Draws one block of `section`; the data is the section's validated payload. */
type BlockRenderer = (block: LayoutBlock, props: SectionProps<unknown>, layout: CustomLayout) => ReactNode;

function heroBlock({ block }: LayoutBlock, { data, context }: SectionProps<unknown>, layout: CustomLayout): ReactNode {
  const hero = data as HeroSection;
  if (block === 'intro') return <HeroContent data={hero} identity={context.identity} centered={layout.align === 'center'} />;
  return hero.codeCard.enabled ? <CodeCard card={hero.codeCard} identity={context.identity} /> : null;
}

function aboutBlock({ block, style }: LayoutBlock, { data }: SectionProps<unknown>): ReactNode {
  const about = data as AboutSection;
  switch (block) {
    case 'bio':
      return (
        <Card className="h-full p-6 sm:p-8">
          <p className="whitespace-pre-line text-lg leading-relaxed text-text">{about.bio}</p>
        </Card>
      );
    case 'currently':
      return about.currently.enabled ? <CurrentlyCard currently={about.currently} /> : null;
    case 'stats':
      return <StatGrid stats={about.stats} columns={style === 'four-columns' ? 4 : 2} />;
    default:
      return about.process.enabled ? <ProcessCard process={about.process} layout={style === 'list' ? 'list' : 'row'} /> : null;
  }
}

function workBlock({ block, style }: LayoutBlock, { data }: SectionProps<unknown>): ReactNode {
  const work = data as WorkSection;
  if (block === 'featured') {
    const featured = work.projects.find((project) => project.featured);
    return featured ? <FeaturedCard project={featured} badge={work.featuredBadge} /> : null;
  }
  const others = work.projects.filter((project) => !project.featured);
  if (others.length === 0) return null;
  return (
    <ul className={style === 'list' ? 'flex flex-col gap-4' : 'grid gap-4 md:grid-cols-2 lg:grid-cols-3'}>
      {others.map((project) => (
        <li key={project.id ?? project.title}>
          <ProjectCard project={project} />
        </li>
      ))}
    </ul>
  );
}

function experienceBlock({ style }: LayoutBlock, { data }: SectionProps<unknown>): ReactNode {
  const experience = data as ExperienceSection;
  return style === 'cards' ? <JobCards data={experience} /> : <TimelineEntries data={experience} />;
}

function stackBlock({ block, style }: LayoutBlock, { data }: SectionProps<unknown>): ReactNode {
  const stack = data as StackSection;
  if (block === 'credentials') return <Credentials data={stack} />;
  return style === 'rows' ? <SkillRows data={stack} /> : <SkillCards data={stack} />;
}

function contactBlock({ block }: LayoutBlock, { data, context }: SectionProps<unknown>, layout: CustomLayout): ReactNode {
  const contact = data as ContactSection;
  if (block === 'message') {
    return contact.body ? <p className="max-w-xl text-lg text-text-muted">{contact.body}</p> : null;
  }
  return <ContactActions data={contact} identity={context.identity} align={layout.align} />;
}

const BLOCK_RENDERERS: Readonly<Record<CustomLayout['section'], BlockRenderer>> = {
  hero: heroBlock,
  about: aboutBlock,
  work: workBlock,
  experience: experienceBlock,
  stack: stackBlock,
  contact: contactBlock,
};

function containerClass(container: { kind: 'stack' | 'columns'; gap: LayoutGap; columns: LayoutColumns | null }): string {
  const gap = GAPS[container.gap];
  return container.kind === 'columns' && container.columns !== null
    ? `grid items-start ${gap} ${COLUMNS[container.columns]}`
    : `flex flex-col ${gap}`;
}

function Container({
  container,
  children,
}: {
  container: { kind: 'stack' | 'columns'; gap: LayoutGap; columns: LayoutColumns | null };
  children: ReactNode;
}) {
  return (
    <div data-layout={container.kind} className={containerClass(container)}>
      {children}
    </div>
  );
}

export interface CustomLayoutRendererProps extends SectionProps<unknown> {
  readonly layout: CustomLayout;
}

/** The section, drawn from `layout` (validated on write; see `validateCustomLayout`). */
export function CustomLayoutRenderer({ layout, ...props }: CustomLayoutRendererProps) {
  const drawBlock = BLOCK_RENDERERS[layout.section];
  const block = (item: LayoutBlock, key: string) => (
    <div key={key} data-block={item.block} className="min-w-0">
      {drawBlock(item, props, layout)}
    </div>
  );
  const body = (
    <Container container={layout.body}>
      {layout.body.children.map((child, index) =>
        child.kind === 'block' ? (
          block(child, `${child.block}-${String(index)}`)
        ) : (
          <Container key={`inner-${String(index)}`} container={child satisfies LayoutInner}>
            {child.children.map((item, inner) => block(item, `${item.block}-${String(index)}-${String(inner)}`))}
          </Container>
        ),
      )}
    </Container>
  );

  if (layout.section === 'hero') {
    const hero = props.data as HeroSection;
    return (
      <section id="hero" aria-labelledby="hero-heading" data-custom-layout="" className="relative overflow-hidden pt-28 sm:pt-36">
        <DotGrid />
        <Glow position="top" />
        <div className={`${CONTAINER} relative pb-16`}>{body}</div>
        {hero.marquee.enabled ? <Marquee items={hero.marquee.items} /> : null}
      </section>
    );
  }

  const section = props.data as { meta: { eyebrow: string }; heading: EmphasisHeading };
  return (
    <div data-custom-layout="">
      <SectionShell
        type={layout.section}
        number={props.number}
        eyebrow={section.meta.eyebrow}
        heading={section.heading}
        // The contact heading's emphasis is the accent everywhere (`contact-section.AC4`).
        emphasisTone={layout.section === 'contact' ? 'accent' : 'muted'}
        align={layout.align}
      >
        {body}
      </SectionShell>
    </div>
  );
}
