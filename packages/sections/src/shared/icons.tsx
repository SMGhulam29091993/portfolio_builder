/**
 * Small inline icons drawn with `currentColor`, so they take the surrounding text colour (no
 * colour literals). Decorative: always `aria-hidden`; the link around an icon carries the name.
 */
import type { ReactElement } from 'react';

interface IconProps { readonly className?: string }

const base = (path: ReactElement, className?: string) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className={className ?? 'h-5 w-5'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

export const GitHubIcon = ({ className }: IconProps) =>
  base(<path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />, className);
export const LinkedInIcon = ({ className }: IconProps) =>
  base(<><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" /><path d="M2 9h4v12H2z" /><circle cx="4" cy="4" r="2" /></>, className);
export const XIcon = ({ className }: IconProps) => base(<path d="M4 4l16 16M20 4L4 20" />, className);
export const GlobeIcon = ({ className }: IconProps) =>
  base(<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" /></>, className);
export const ArrowUpRightIcon = ({ className }: IconProps) => base(<path d="M7 17L17 7M8 7h9v9" />, className);
export const ArrowDownRightIcon = ({ className }: IconProps) => base(<path d="M7 7l10 10M17 8v9H8" />, className);
export const PinIcon = ({ className }: IconProps) =>
  base(<><path d="M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>, className);
export const SparkleIcon = ({ className }: IconProps) => base(<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6" />, className);
export const CapIcon = ({ className }: IconProps) => base(<><path d="M2 9l10-5 10 5-10 5z" /><path d="M6 11v5c3 2 9 2 12 0v-5" /></>, className);
export const RibbonIcon = ({ className }: IconProps) => base(<><circle cx="12" cy="9" r="5" /><path d="M9 13l-2 8 5-3 5 3-2-8" /></>, className);
export const MailIcon = ({ className }: IconProps) => base(<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></>, className);
export const CopyIcon = ({ className }: IconProps) => base(<><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>, className);

/** The icon and visible name for an identity social platform. */
export const PLATFORMS = {
  github: { label: 'GitHub', Icon: GitHubIcon },
  linkedin: { label: 'LinkedIn', Icon: LinkedInIcon },
  x: { label: 'X', Icon: XIcon },
  website: { label: 'Website', Icon: GlobeIcon },
} as const;
