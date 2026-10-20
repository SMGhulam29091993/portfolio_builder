'use client';
/**
 * Where the header shows the publish status (`cms-panel-shell.AC11`). `publish-pipeline` fills
 * it from its `API01`; until then it only links to the publish area.
 */
import { GuardedLink } from './guarded-link';

export function PublishStatusSlot() {
  return (
    <GuardedLink href="/cms/publish" className="rounded-full border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:border-neutral-500">
      Publish
    </GuardedLink>
  );
}
