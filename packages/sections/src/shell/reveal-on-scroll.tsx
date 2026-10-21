'use client';
/**
 * Sections fade up once as they enter the viewport (owner answer 2026-10-20; spec → Resolved
 * Questions). Nothing is hidden until this has run, so without JavaScript every section shows
 * (AC18); and nothing is hidden when the theme's motion is `none` or the visitor prefers reduced
 * motion. Sections already on screen at load are never hidden. Renders nothing.
 */
import { useEffect } from 'react';

export function RevealOnScroll() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-theme-root]');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!root || reduced || root.dataset.motion === 'none' || !('IntersectionObserver' in window)) return undefined;

    const sections = [...root.querySelectorAll<HTMLElement>('main section[id]')].filter(
      (section) => section.getBoundingClientRect().top > window.innerHeight,
    );
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = 'shown';
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    for (const section of sections) {
      section.dataset.reveal = 'pending';
      observer.observe(section);
    }
    return () => {
      observer.disconnect();
      for (const section of sections) delete section.dataset.reveal;
    };
  }, []);
  return null;
}
