/**
 * The site shell (`public-site-rendering.T04`; UT03–UT05; AC3–AC7), rendered to static markup.
 * The mobile menu's interaction (UT09) runs in the browser (`public-site-rendering.E2E04`).
 */
import type { Identity } from '@portfolio/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { buildNavModel } from './nav-model.js';
import { footerLines, SiteFooter } from './site-footer.js';
import { SiteNav } from './site-nav.js';
import { SkipLink } from './skip-link.js';

const identity = {
  fullName: 'Ada Lovelace',
  monogram: 'AL',
  resume: { assetId: 'r1', label: 'Résumé' },
  footer: { copyrightName: 'Ada Lovelace', builtWith: ['Next.js', 'Tailwind', 'Motion'] },
} as unknown as Identity;

const meta = (navLabel: string, showInNav = true) => ({ meta: { eyebrow: 'x', navLabel, showInNav } });

const sections = [
  { type: 'hero', data: { headline: 'x' } },
  { type: 'about', data: meta('About') },
  { type: 'work', data: meta('Work', false) },
  { type: 'stack', data: meta('Stack') },
  { type: 'contact', data: meta('Contact') },
];

describe('buildNavModel', () => {
  it('public-site-rendering.UT03 — visible in-nav sections only, in order; contact flagged', () => {
    const model = buildNavModel(identity, sections, null);
    expect(model.links).toEqual([
      { type: 'about', label: 'About', emphasis: false },
      { type: 'stack', label: 'Stack', emphasis: false },
      { type: 'contact', label: 'Contact', emphasis: true },
    ]);
    expect(model.monogram).toBe('AL');
  });

  it('public-site-rendering.UT04 — the résumé item with its URL, or none', () => {
    expect(buildNavModel(identity, sections, '/api/v1/public/portfolios/ada/assets/r1/cv.pdf').resume).toEqual({
      label: 'Résumé',
      href: '/api/v1/public/portfolios/ada/assets/r1/cv.pdf',
    });
    expect(buildNavModel(identity, sections, null).resume).toBeNull();
  });

  it('ignores malformed meta and blank labels', () => {
    const odd = [{ type: 'a', data: null }, { type: 'b', data: { meta: null } }, { type: 'c', data: meta('  ') }];
    expect(buildNavModel(identity, odd, null).links).toEqual([]);
  });
});

describe('SiteNav', () => {
  it('public-site-rendering.AC3, AC5 — header and nav landmarks, monogram to the top, links, filled contact, résumé in a new tab', () => {
    const html = renderToStaticMarkup(<SiteNav model={buildNavModel(identity, sections, '/cv.pdf')} />);
    expect(html).toMatch(/^<header/);
    expect(html).toContain('<nav aria-label="Main"');
    expect(html).toContain('href="#top"');
    expect(html).toContain('aria-label="Ada Lovelace, back to top"');
    expect(html).toContain('href="#about"');
    expect(html).toMatch(/href="#contact" class="[^"]*bg-surface-raised/);
    expect(html).toContain('href="/cv.pdf" target="_blank" rel="noopener noreferrer"');
    expect(html).toContain('aria-expanded="false"');
  });

  it('public-site-rendering.AC5 and Edge — no résumé pill without a résumé; no link row or menu with only the hero', () => {
    const html = renderToStaticMarkup(<SiteNav model={buildNavModel(identity, sections.slice(0, 1), null)} />);
    expect(html).not.toContain('Résumé');
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('Menu');
  });
});

describe('SiteFooter', () => {
  it('public-site-rendering.UT05 — the year, the name and the credits joined by middle dots', () => {
    expect(footerLines(identity.footer, 2031)).toEqual({ copyright: '© 2031 Ada Lovelace', credits: 'Built with Next.js · Tailwind · Motion' });
    expect(footerLines({ ...identity.footer, builtWith: [] }, 2031).credits).toBe('');
    const html = renderToStaticMarkup(<SiteFooter footer={identity.footer} year={2031} />);
    expect(html).toMatch(/^<footer/);
    expect(html).toContain('© 2031 Ada Lovelace');
  });
});

describe('SkipLink', () => {
  it('public-site-rendering.AC6 — targets main', () => {
    expect(renderToStaticMarkup(<SkipLink />)).toContain('href="#main"');
  });
});
