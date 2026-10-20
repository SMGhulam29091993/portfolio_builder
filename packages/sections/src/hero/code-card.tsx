/**
 * The hero's code card (`hero-section.T03`; AC9, AC10): a window bar with the filename,
 * `export const <name> = {`, one line per entry — key in the accent colour, strings quoted,
 * lists bracketed — and the closing brace; a long line scrolls inside the card, never widening
 * the page. The footer shows the identity's location and time zone.
 */
import type { HeroSection, Identity } from '@portfolio/contracts';

import { Card, PinIcon } from '../shared/index.js';

const quote = (text: string) => `"${text}"`;

export function CodeCard({ card, identity }: { card: HeroSection['codeCard']; identity: Identity | null }) {
  const location = card.showLocation && identity ? [identity.location.label, identity.location.timezoneLabel].filter(Boolean).join(' · ') : '';
  return (
    <Card raised className="w-full min-w-0 overflow-hidden shadow-2xl">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <span aria-hidden="true" className="h-3 w-3 rounded-full bg-border" />
        <span aria-hidden="true" className="h-3 w-3 rounded-full bg-border" />
        <span aria-hidden="true" className="h-3 w-3 rounded-full bg-border" />
        <span className="ml-2 font-mono text-xs text-text-muted">{card.filename}</span>
      </div>
      <pre className="overflow-x-auto px-5 py-4 font-mono text-[13px] leading-7 text-text">
        <code>
          <span className="text-text-muted">export const </span>
          {card.exportName}
          <span className="text-text-muted"> = {'{'}</span>
          {'\n'}
          {card.entries.map((entry) => (
            <span key={entry.id ?? entry.key} className="block pl-5">
              <span className="text-accent">{entry.key}</span>
              <span className="text-text-muted">: </span>
              {Array.isArray(entry.value) ? `[${entry.value.map(quote).join(', ')}]` : quote(entry.value)}
              <span className="text-text-muted">,</span>
            </span>
          ))}
          <span className="text-text-muted">{'}'}</span>
        </code>
      </pre>
      {location ? (
        <p className="flex items-center gap-2 border-t border-border px-5 py-3 text-xs text-text-muted">
          <PinIcon className="h-4 w-4" />
          {location}
        </p>
      ) : null}
    </Card>
  );
}
