/**
 * The twelve section renderers rendered to static markup with generated fixtures (the section
 * specs' structural ACs: headings, derived numbers, identity-driven parts, empty-list handling,
 * date rules, links). Layout at 1440 / 390 is checked in the browser journeys.
 */
import type {
  AboutSection,
  ContactSection,
  ExperienceSection,
  HeroSection,
  Identity,
  StackSection,
  WorkSection,
} from '@portfolio/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LAYOUT_BLOCKS, SECTION_TYPES, validateCustomLayout, type CustomLayout } from '@portfolio/design-tokens';

import { rendererRegistry } from './catalog.js';
import { CustomLayoutRenderer } from './custom/custom-layout.js';
import { PortfolioPage } from './portfolio-page.js';
import { formatMonth, orderEntries } from './experience/dates.js';
import { mailtoHref } from './contact/contact-parts.js';

const identity: Identity = {
  fullName: 'Ann Lee',
  monogram: 'AL',
  roleTitle: 'Engineer',
  email: 'ann@example.test',
  location: { label: 'Kolkata, India', timezoneLabel: 'IST (UTC+5:30)' },
  availability: { enabled: true, label: 'Open to roles' },
  socials: [{ id: 's', platform: 'github', url: 'https://github.com/ann' }],
  resume: { assetId: null, label: 'Résumé' },
  footer: { copyrightName: 'Ann Lee', builtWith: [] },
  seo: { title: 't', description: 'd', ogImageAssetId: null },
};

function render(type: string, variant: string, data: unknown, context = { identity }, number = '01'): string {
  const Renderer = rendererRegistry.get(type, variant);
  if (!Renderer) throw new Error(`no renderer ${type}/${variant}`);
  return renderToStaticMarkup(<Renderer data={data} number={number} position={1} context={context} />);
}

const hero: HeroSection = {
  heading: { lead: 'I build', emphasis: 'things.' },
  intro: { prefix: "Hi, I'm", showName: true, body: 'a developer.' },
  primaryCta: { label: 'See my work', target: { kind: 'section', sectionType: 'work' } },
  secondaryCta: { label: 'Repo', target: { kind: 'url', url: 'https://example.test' } },
  showAvailability: true,
  showSocialIcons: true,
  codeCard: {
    enabled: true,
    filename: 'ann.config.ts',
    exportName: 'me',
    showLocation: true,
    entries: [
      { id: 'a', key: 'role', value: 'Engineer' },
      { id: 'b', key: 'stack', value: ['TS', 'Go'] },
    ],
  },
  marquee: { enabled: true, items: ['A', 'B', 'C', 'D'] },
};

describe('hero', () => {
  it.each(['split-code-card', 'centered'])('%s: one h1 with the accent emphasis, name and dash, badge, CTAs, card, marquee', (variant) => {
    const html = render('hero', variant, hero);

    expect(html.match(/<h1/g)).toHaveLength(1);
    expect(html).toContain('<em class="font-display font-normal italic text-accent">things.</em>');
    expect(html).toContain('<strong class="font-semibold text-text">Ann Lee</strong> — ');
    expect(html).toContain('Open to roles');
    expect(html).toContain('href="#work"');
    expect(html).toContain('href="https://example.test" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('aria-label="GitHub"');
    expect(html).toContain('&quot;Engineer&quot;');
    expect(html).toContain('[&quot;TS&quot;, &quot;Go&quot;]');
    expect(html).toContain('Kolkata, India · IST (UTC+5:30)');
    expect(html.match(/<ul aria-hidden="true"/g)).toHaveLength(1);
  });

  it('hero-section.AC5, AC6, AC8 — no name or dash, no badge, no icons when switched off or empty', () => {
    const html = render('hero', 'split-code-card', { ...hero, intro: { ...hero.intro, showName: false }, showAvailability: false }, {
      identity: { ...identity, socials: [] },
    });

    expect(html).not.toContain('Ann Lee');
    expect(html).not.toContain('Open to roles');
    expect(html).not.toContain('Social links');
  });
});

const about: AboutSection = {
  meta: { eyebrow: 'About', navLabel: 'About', showInNav: true },
  heading: { lead: 'Lead', emphasis: 'emphasis' },
  bio: 'Bio text.',
  currently: { enabled: true, label: 'Currently', text: 'Building' },
  stats: [{ id: 's1', value: '2+', label: 'Years' }],
  process: { enabled: true, eyebrow: 'How', title: 'Title', steps: [{ id: 'a', title: 'One', description: 'd' }, { id: 'b', title: 'Two', description: 'd' }] },
};

describe('about', () => {
  it.each(['bento', 'stacked'])('%s: labelled h2 with the derived number, numbered steps', (variant) => {
    const html = render('about', variant, about, { identity }, '02');

    expect(html).toContain('aria-labelledby="about-heading"');
    expect(html).toContain('02 — About');
    expect(html).toMatch(/<h2 id="about-heading"/);
    expect(html).toContain('text-text-muted">emphasis</em>');
    expect(html).toMatch(/>01<\/span><h4[^>]*>One/);
    expect(html).toMatch(/>02<\/span><h4[^>]*>Two/);
  });

  it('about-section.AC5, AC7 — hidden cards and an empty stat grid leave nothing behind', () => {
    const html = render('about', 'bento', { ...about, stats: [], currently: { ...about.currently, enabled: false }, process: { ...about.process, enabled: false } });

    expect(html).not.toContain('Currently');
    expect(html).not.toContain('How');
    expect(html).not.toContain('<ul');
  });
});

const work: WorkSection = {
  meta: { eyebrow: 'Work', navLabel: 'Work', showInNav: true },
  heading: { lead: 'Lead', emphasis: 'em' },
  featuredBadge: 'Featured',
  projects: [
    { id: 'f', title: 'Big', category: 'c', description: 'd', featured: true, metrics: [{ id: 'm', value: '50+', label: 'endpoints' }], tags: ['TS'], link: null },
    { id: 'p', title: 'Small', category: 'c', description: 'd', featured: false, metrics: [], tags: [], link: 'https://small.example' },
  ],
};

describe('work', () => {
  it.each(['featured-grid', 'list'])('%s: h3 titles, accent metrics, link only where set', (variant) => {
    const html = render('work', variant, work);

    expect(html.match(/<h3/g)).toHaveLength(2);
    expect(html).toContain('text-accent">50+</dd>');
    expect(html).toContain('aria-label="Open Small (opens in a new tab)"');
    expect(html.match(/opens in a new tab/g)).toHaveLength(1);
    expect(html).toContain('Featured');
  });

  it('work-showcase.AC6, AC8 — no featured project and no metrics leave no empty area or divider', () => {
    const html = render('work', 'featured-grid', { ...work, projects: [{ ...work.projects[1], featured: false }] });

    expect(html).not.toContain('Featured');
    expect(html).not.toContain('border-t');
  });
});

const experience: ExperienceSection = {
  meta: { eyebrow: 'Experience', navLabel: 'Experience', showInNav: true },
  heading: { lead: 'Where', emphasis: 'shipped.' },
  presentLabel: 'Present',
  entries: [
    { id: 'old', company: 'Old Co', role: 'r', start: { year: 2024, month: 1 }, end: { year: 2024, month: 9 }, highlights: ['h'] },
    { id: 'now', company: 'Now Co', role: 'r', location: 'Kolkata', start: { year: 2024, month: 9 }, end: null, highlights: ['h'] },
  ],
};

describe('experience', () => {
  it('experience-timeline.AC3, AC4 — current first, then start descending; reference date format', () => {
    expect(orderEntries(experience.entries).map((entry) => entry.company)).toEqual(['Now Co', 'Old Co']);
    expect(formatMonth({ year: 2024, month: 9 })).toBe('Sept 2024');
  });

  it.each(['timeline', 'cards'])('%s: ordered list, h3 companies, machine-readable times', (variant) => {
    const html = render('experience', variant, experience);

    expect(html).toContain('<ol');
    expect(html.indexOf('Now Co')).toBeLessThan(html.indexOf('Old Co'));
    expect(html).toContain('<time dateTime="2024-09">Sept 2024</time> — Present');
    expect(html).toContain('<time dateTime="2024-01">Jan 2024</time> — <time dateTime="2024-09">Sept 2024</time>');
  });
});

const stack: StackSection = {
  meta: { eyebrow: 'Stack', navLabel: 'Stack', showInNav: true },
  heading: { lead: 'Tools', emphasis: 'I use.' },
  groups: [{ id: 'g', label: 'Languages', items: ['TS', 'Go'] }],
  education: { enabled: true, label: 'Education', entries: [{ id: 'e', title: 'B.Tech', institution: 'X', startYear: 2012, endYear: null }] },
  certifications: { enabled: true, label: 'Certifications', entries: [{ id: 'c', name: 'Claude 101', issuer: 'Anthropic', url: 'https://cert.example' }] },
};

describe('stack', () => {
  it.each(['chip-groups', 'columns'])('%s: h3 labels, chip lists, Present for an open end, linked certificate', (variant) => {
    const html = render('stack', variant, stack);

    expect(html.match(/<h3/g)).toHaveLength(3);
    expect(html).toContain('2012 – Present');
    expect(html).toContain('aria-label="Claude 101, Anthropic (opens in a new tab)"');
  });

  it('stack-credentials.AC7 — disabled or empty lists render nothing', () => {
    const html = render('stack', 'chip-groups', {
      ...stack,
      education: { ...stack.education, enabled: false },
      certifications: { ...stack.certifications, entries: [] },
    });

    expect(html).not.toContain('Education');
    expect(html).not.toContain('Certifications');
  });
});

const contact: ContactSection = {
  meta: { eyebrow: 'Contact', navLabel: 'Contact', showInNav: true },
  heading: { lead: 'Build?', emphasis: "Let's talk." },
  body: 'Open to roles.',
  emailCta: { label: 'Email me', subject: 'Hello & welcome' },
  showCopyEmail: true,
  showSocialLinks: true,
};

describe('contact', () => {
  it('contact-section.AC5 — mailto with an encoded subject', () => {
    expect(mailtoHref('a@b.test', 'Hello & welcome')).toBe('mailto:a@b.test?subject=Hello%20%26%20welcome');
    expect(mailtoHref('a@b.test', undefined)).toBe('mailto:a@b.test');
  });

  it.each(['glow-card', 'minimal'])('%s: accent emphasis, email button, copy chip, named social links', (variant) => {
    const html = render('contact', variant, contact);

    expect(html).toContain('text-accent">Let&#x27;s talk.</em>');
    expect(html).toContain('mailto:ann@example.test?subject=Hello%20%26%20welcome');
    expect(html).toContain('aria-label="Copy ann@example.test"');
    expect(html).toContain('GitHub</a>');
  });
});

describe('CustomLayoutRenderer (design-library.UT03 / AC3)', () => {
  const block = (name: string, style: string | null = null) => ({ kind: 'block' as const, block: name, style });
  const data: Record<string, unknown> = { hero, about, work, experience, stack, contact };

  /** Every block of `section`, stacked, each with its first style. */
  function stacked(section: CustomLayout['section']): CustomLayout {
    const children = Object.entries(LAYOUT_BLOCKS[section]).map(([name, styles]) => block(name, styles[0] ?? null));
    return { section, align: 'start', body: { kind: 'stack', gap: 'md', columns: null, children } };
  }

  const draw = (layout: CustomLayout) =>
    renderToStaticMarkup(<CustomLayoutRenderer layout={layout} data={data[layout.section]} number="02" position={2} context={{ identity }} />);

  const blocksIn = (html: string) => [...html.matchAll(/data-block="([^"]+)"/g)].map((match) => match[1]);

  it.each(SECTION_TYPES)('%s: every block drawn exactly once, in order', (section) => {
    const layout = stacked(section);
    expect(validateCustomLayout(layout, section)).toMatchObject({ ok: true });
    expect(blocksIn(draw(layout))).toEqual(Object.keys(LAYOUT_BLOCKS[section]));
  });

  it('arranges blocks in columns that stack on phones, with the chosen gaps', () => {
    const layout: CustomLayout = {
      section: 'about',
      align: 'center',
      body: {
        kind: 'stack',
        gap: 'lg',
        columns: null,
        children: [
          { kind: 'columns', gap: 'md', columns: '2-1', children: [block('bio'), block('currently')] },
          { kind: 'columns', gap: 'sm', columns: '1-1', children: [block('stats', 'four-columns'), block('process', 'list')] },
        ],
      },
    };
    const html = draw(layout);
    expect(blocksIn(html)).toEqual(['bio', 'currently', 'stats', 'process']);
    expect(html).toContain('class="flex flex-col gap-10"');
    expect(html).toContain('class="grid items-start gap-6 md:grid-cols-[2fr_1fr]"');
    expect(html).toContain('class="grid items-start gap-4 md:grid-cols-2"');
    // The heading follows the layout's alignment.
    expect(html).toMatch(/items-center text-center/);
  });

  it('keeps the section frame: the hero backdrop and marquee; the contact accent; text stays text', () => {
    const heroHtml = draw(stacked('hero'));
    expect(heroHtml).toContain('id="hero"');
    expect(heroHtml).toContain('A'); // marquee items
    const contactHtml = draw(stacked('contact'));
    expect(contactHtml).toContain('text-accent');
    const work = draw({ ...stacked('work'), body: { kind: 'stack', gap: 'md', columns: null, children: [block('projects', 'list'), block('featured')] } });
    expect(blocksIn(work)).toEqual(['projects', 'featured']);
    expect(work).toContain('flex flex-col gap-4');
  });

  it('PortfolioPage draws a type from its custom layout instead of its variant', () => {
    const layout = stacked('work');
    const html = renderToStaticMarkup(
      <PortfolioPage
        sections={[{ type: 'work', visible: true, data: work }]}
        sectionOrder={['work']}
        registry={rendererRegistry}
        variants={{ work: 'featured-grid' }}
        context={{ identity }}
        customLayouts={{ work: layout }}
      />,
    );
    expect(html).toContain('data-custom-layout');
    // A layout for another section is ignored.
    const ignored = renderToStaticMarkup(
      <PortfolioPage sections={[{ type: 'work', visible: true, data: work }]} sectionOrder={['work']} registry={rendererRegistry} context={{ identity }} customLayouts={{ work: stacked('about') }} />,
    );
    expect(ignored).not.toContain('data-custom-layout');
  });
});
