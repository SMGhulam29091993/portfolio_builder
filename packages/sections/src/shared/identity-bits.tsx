/**
 * Identity-driven pieces shared by the hero and contact (`hero-section.T02`; AC6, AC8;
 * `contact-section.AC8`): the availability badge and the social link rows.
 */
import type { Identity } from '@portfolio/contracts';

import { PLATFORMS } from './icons.js';

export function AvailabilityBadge({ identity }: { identity: Identity | null }) {
  if (!identity?.availability.enabled) return null;
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text-muted">
      <span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent" />
      {identity.availability.label}
    </p>
  );
}

const LINK = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

/** Icon-only links whose accessible name states the platform (hero, AC8). */
export function SocialIconRow({ identity }: { identity: Identity | null }) {
  if (!identity || identity.socials.length === 0) return null;
  return (
    <ul className="flex items-center gap-2" aria-label="Social links">
      {identity.socials.map((social) => {
        const { label, Icon } = PLATFORMS[social.platform];
        return (
          <li key={social.id ?? social.platform}>
            <a
              href={social.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              className={`flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-muted transition-colors hover:border-text-muted hover:text-text ${LINK}`}
            >
              <Icon />
            </a>
          </li>
        );
      })}
    </ul>
  );
}

/** Icon plus visible platform name (contact, `contact-section.AC8`). */
export function SocialTextLinks({ identity }: { identity: Identity | null }) {
  if (!identity || identity.socials.length === 0) return null;
  return (
    <ul className="flex flex-wrap items-center justify-center gap-5" aria-label="Social links">
      {identity.socials.map((social) => {
        const { label, Icon } = PLATFORMS[social.platform];
        return (
          <li key={social.id ?? social.platform}>
            <a href={social.url} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 rounded text-sm text-text-muted underline-offset-4 hover:text-text hover:underline ${LINK}`}>
              <Icon className="h-4 w-4" />
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
