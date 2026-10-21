/**
 * The frame every non-hero section shares (`about-section.T02`; AC4): an anchor target with the
 * section's id, labelled by its `h2`, and the header — derived number, eyebrow, heading with its
 * emphasis in the display font.
 */
import type { EmphasisHeading } from '@portfolio/contracts';
import type { ReactNode } from 'react';

/** The id of a section's heading; CTAs move focus here (`hero-section.AC7`). */
export function headingId(type: string): string {
  return `${type}-heading`;
}

/** The page-width container every section uses. */
export const CONTAINER = 'mx-auto w-full max-w-6xl px-5 sm:px-8';

/** The lead plus the emphasis in the display font's italic. */
export function EmphasisHeadingText({ heading, tone }: { heading: EmphasisHeading; tone: 'accent' | 'muted' }) {
  return (
    <>
      {heading.lead}
      {heading.emphasis ? (
        <>
          {' '}
          <em className={`font-display font-normal italic ${tone === 'accent' ? 'text-accent' : 'text-text-muted'}`}>{heading.emphasis}</em>
        </>
      ) : null}
    </>
  );
}

export interface SectionShellProps {
  readonly type: string;
  readonly number: string;
  readonly eyebrow: string;
  readonly heading: EmphasisHeading;
  /** `muted` everywhere but contact, whose emphasis is the accent (`contact-section.AC4`). */
  readonly emphasisTone?: 'accent' | 'muted';
  readonly align?: 'start' | 'center';
  readonly children: ReactNode;
}

export function SectionShell({ type, number, eyebrow, heading, emphasisTone = 'muted', align = 'start', children }: SectionShellProps) {
  return (
    <section id={type} aria-labelledby={headingId(type)} className="scroll-mt-24 py-16 sm:py-24">
      <div className={CONTAINER}>
        <SectionHeader type={type} number={number} eyebrow={eyebrow} heading={heading} emphasisTone={emphasisTone} align={align} />
        {children}
      </div>
    </section>
  );
}

export function SectionHeader({
  type,
  number,
  eyebrow,
  heading,
  emphasisTone = 'muted',
  align = 'start',
}: Omit<SectionShellProps, 'children'>) {
  return (
    <header className={`mb-10 flex flex-col gap-3 ${align === 'center' ? 'items-center text-center' : ''}`}>
      <p className="font-mono text-xs uppercase tracking-[0.25em] text-accent">
        {number ? `${number} — ` : ''}
        {eyebrow}
      </p>
      <h2 id={headingId(type)} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-text outline-none sm:text-5xl">
        <EmphasisHeadingText heading={heading} tone={emphasisTone} />
      </h2>
    </header>
  );
}

/** A card surface with the theme's radius and hairline border. */
export function Card({ children, className, raised = false }: { children: ReactNode; className?: string; raised?: boolean }) {
  return (
    <div className={`rounded-[var(--radius)] border border-border ${raised ? 'bg-surface-raised' : 'bg-surface'} ${className ?? ''}`}>
      {children}
    </div>
  );
}

/** The soft accent glow behind a block; hidden by `effects.glow: false` (globals: `[data-glow="off"]`). */
export function Glow({ position }: { position: 'top' | 'bottom' }) {
  return (
    <div
      aria-hidden="true"
      data-effect="glow"
      className={`pointer-events-none absolute inset-x-0 ${position === 'top' ? 'top-0' : 'bottom-0'} h-2/3 opacity-30 blur-3xl`}
      style={{ background: `radial-gradient(ellipse at ${position === 'top' ? '50% 0%' : '50% 100%'}, var(--color-accent), transparent 70%)` }}
    />
  );
}

/** The dot-grid texture; hidden by `effects.dotGrid: false`. */
export function DotGrid() {
  return (
    <div
      aria-hidden="true"
      data-effect="dot-grid"
      className="pointer-events-none absolute inset-0 opacity-20"
      style={{ backgroundImage: 'radial-gradient(var(--color-border) 1px, transparent 1px)', backgroundSize: '22px 22px' }}
    />
  );
}
