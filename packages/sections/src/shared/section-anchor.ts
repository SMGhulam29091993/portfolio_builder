/**
 * In-page jumps (`public-site-rendering.AC6`): after the browser's own jump to `#<type>`, focus
 * moves to that section's heading so keyboard and screen-reader users land where the page did.
 */
import { headingId } from './layout.js';

/** Moves focus to the heading of the section `type`, without scrolling again. */
export function focusSectionHeading(type: string): void {
  requestAnimationFrame(() => {
    document.getElementById(headingId(type))?.focus({ preventScroll: true });
  });
}
