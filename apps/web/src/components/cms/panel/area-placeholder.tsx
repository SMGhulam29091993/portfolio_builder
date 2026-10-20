/**
 * The mount point for a CMS area another spec fills (`cms-panel-shell` → Screens). Renders the
 * area's heading and a plain note, so navigation works before the area exists.
 */
export function AreaPlaceholder({ title, note }: { title: string; note: string }) {
  return (
    <section aria-labelledby="area-heading" className="flex flex-col gap-3">
      <h1 id="area-heading" className="text-2xl font-semibold">
        {title}
      </h1>
      <p className="text-neutral-400">{note}</p>
    </section>
  );
}
