'use client';
/**
 * The section links below 768 (`public-site-rendering.AC4`; OQ1 resolved): a "Menu" button that
 * opens a panel under the bar. `aria-expanded` and `aria-controls` describe it; Escape, choosing
 * a link or a click outside close it, and Escape returns focus to the button.
 */
import { useEffect, useId, useRef, useState } from 'react';

import type { NavLink } from './nav-model.js';
import { SectionLink } from './section-link.js';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

export function MobileMenu({ links }: { links: readonly NavLink[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      button.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  if (links.length === 0) return null;
  return (
    <div ref={root} className="md:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen(!open);
        }}
        className={`rounded-full px-4 py-2 text-sm text-text-muted transition hover:text-text ${FOCUS}`}
      >
        Menu
      </button>
      <ul
        id={panelId}
        hidden={!open}
        className="absolute inset-x-0 top-full mt-2 flex flex-col gap-1 rounded-3xl border border-border bg-surface p-2 shadow-2xl"
      >
        {links.map((link) => (
          <li key={link.type}>
            <SectionLink
              type={link.type}
              onNavigate={() => {
                setOpen(false);
              }}
              className={`block rounded-full px-4 py-3 text-sm transition ${link.emphasis ? 'bg-surface-raised text-text' : 'text-text-muted hover:text-text'} ${FOCUS}`}
            >
              {link.label}
            </SectionLink>
          </li>
        ))}
      </ul>
    </div>
  );
}
