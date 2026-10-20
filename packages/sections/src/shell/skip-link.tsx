/**
 * The page's first focusable element (`public-site-rendering.AC6`): visible only when focused,
 * it jumps past the nav to the main content.
 */
export const MAIN_ID = 'main';

export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      className="sr-only z-[60] rounded-full bg-accent px-4 py-2 text-sm font-medium text-on-accent focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      Skip to content
    </a>
  );
}
