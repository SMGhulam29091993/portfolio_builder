/**
 * The tech strip (`hero-section.T04`; AC11): one line of mono items separated by accent dots,
 * faded at both edges, looping leftward (~40 s; owner answer 2026-10-20) and pausing on hover and
 * focus. The duplicated half that makes the loop seamless is hidden from assistive technology.
 * Motion stops under `motion: none` and reduced motion through the global gating
 * (`design-theme.AC9`), leaving a static strip.
 */
function Items({ items, hidden }: { items: readonly string[]; hidden: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center gap-6 pr-6">
      {items.map((item, index) => (
        <li key={`${item}-${String(index)}`} className="flex items-center gap-6 whitespace-nowrap">
          <span>{item}</span>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
        </li>
      ))}
    </ul>
  );
}

export function Marquee({ items }: { items: readonly string[] }) {
  return (
    <div
      data-marquee=""
      className="group relative overflow-hidden border-y border-border py-4 font-mono text-sm text-text-muted"
      // A mask uses only alpha: `black` means fully visible here, not a colour on the page.
      style={{ maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)' }}
    >
      <div className="flex w-max animate-[pb-marquee_40s_linear_infinite] group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
        <Items items={items} hidden={false} />
        <Items items={items} hidden />
      </div>
    </div>
  );
}
