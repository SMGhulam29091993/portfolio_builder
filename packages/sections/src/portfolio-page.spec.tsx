/**
 * The page composer and the renderer registry (`section-engine.UT11`, `UT12`, `UT17`; AC13,
 * AC14), rendered to static markup — no DOM needed.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { composeSections } from './compose.js';
import { PortfolioPage } from './portfolio-page.js';
import { SectionRendererRegistry, type SectionRendererProps } from './registry.js';

function Probe({ data, number }: SectionRendererProps<{ label: string }>) {
  return <section data-number={number}>{data.label}</section>;
}

function Alternate({ data }: SectionRendererProps<{ label: string }>) {
  return <aside>{data.label}</aside>;
}

const registry = new SectionRendererRegistry([
  { type: 'hero', variant: 'default', component: Probe, label: 'Reference' },
  { type: 'about', variant: 'default', component: Probe, label: 'Reference' },
  { type: 'work', variant: 'default', component: Probe, label: 'Reference' },
  { type: 'work', variant: 'compact', component: Alternate, label: 'Compact' },
  { type: 'contact', variant: 'default', component: Probe, label: 'Reference' },
]);

const sections = [
  { type: 'contact', visible: true, data: { label: 'Contact' } },
  { type: 'about', visible: false, data: { label: 'About' } },
  { type: 'hero', visible: true, data: { label: 'Hero' } },
  { type: 'work', visible: true, data: { label: 'Work' } },
];

describe('composeSections (section-engine.UT11 / AC13)', () => {
  it('puts hero first, follows the order, drops hidden sections and numbers consecutively', () => {
    const placed = composeSections(sections, ['about', 'work', 'contact']);

    expect(placed.map((s) => [s.type, s.number])).toEqual([
      ['hero', ''],
      ['work', '01'],
      ['contact', '02'],
    ]);
  });

  it('section-engine.UT17 — with every hideable section hidden only hero remains', () => {
    const allHidden = sections.map((s) => (s.type === 'hero' ? s : { ...s, visible: false }));

    expect(composeSections(allHidden, ['about', 'work', 'contact']).map((s) => s.type)).toEqual(['hero']);
  });

  it('appends a visible type the order does not list', () => {
    expect(composeSections(sections, ['contact']).map((s) => s.type)).toEqual(['hero', 'contact', 'work']);
  });
});

describe('PortfolioPage (section-engine.UT12 / AC14)', () => {
  it('renders through the registry with derived numbers and the chosen variant', () => {
    const html = renderToStaticMarkup(
      <PortfolioPage
        sections={sections}
        sectionOrder={['about', 'work', 'contact']}
        registry={registry}
        variants={{ work: 'compact', contact: 'missing-variant' }}
        context={null}
      />,
    );

    expect(html).toBe(
      '<section data-number="">Hero</section><aside>Work</aside><section data-number="02">Contact</section>',
    );
  });

  it('skips an unknown type, reports it and renders the rest', () => {
    const unknown: string[] = [];
    const html = renderToStaticMarkup(
      <PortfolioPage
        sections={[...sections, { type: 'blog', visible: true, data: { label: 'Blog' } }]}
        sectionOrder={['about', 'work', 'contact', 'blog']}
        registry={registry}
        context={null}
        onUnknownType={(type) => unknown.push(type)}
      />,
    );

    expect(unknown).toEqual(['blog']);
    expect(html).toContain('Contact');
    expect(html).not.toContain('Blog');
  });
});

describe('SectionRendererRegistry', () => {
  it('refuses a duplicate type and variant, and lists variants default first', () => {
    expect(
      () =>
        new SectionRendererRegistry([
          { type: 'x', variant: 'default', component: Probe, label: 'A' },
          { type: 'x', variant: 'default', component: Probe, label: 'B' },
        ]),
    ).toThrow(/registered twice/);
    expect(registry.variantsOf('work')).toEqual([
      { variant: 'default', label: 'Reference' },
      { variant: 'compact', label: 'Compact' },
    ]);
  });
});

describe('PortfolioPage wrapSection', () => {
  it('wraps each rendered section, e.g. in an error boundary', () => {
    const html = renderToStaticMarkup(
      <PortfolioPage
        sections={sections}
        sectionOrder={['work']}
        registry={registry}
        context={null}
        wrapSection={(type, node) => <div data-wrapped={type}>{node}</div>}
      />,
    );

    expect(html).toContain('<div data-wrapped="hero">');
    expect(html).toContain('<div data-wrapped="work">');
  });
});

describe('ThemeRoot (design-theme.AC7, AC9)', () => {
  it('sets every token as a custom property and marks the motion setting', async () => {
    const { DEFAULT_DESIGN } = await import('@portfolio/design-tokens');
    const { ThemeRoot } = await import('./theme-root.js');
    const html = renderToStaticMarkup(
      <ThemeRoot theme={{ ...DEFAULT_DESIGN.theme, effects: { ...DEFAULT_DESIGN.theme.effects, motion: 'none' } }}>
        <p>x</p>
      </ThemeRoot>,
    );

    expect(html).toContain('data-motion="none"');
    expect(html).toContain('--color-accent:#c0f83c');
    expect(html).toContain('--font-display:var(--font-instrument-serif)');
  });
});

