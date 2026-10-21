'use client';
/**
 * The header's publish status (`cms-panel-shell.AC11`, filled by `publish-pipeline.T09`): the live
 * version and when it went live, or "Never published"; an "Unpublished changes" badge when the
 * draft differs from what is live; and a link to `/cms/publish`. While the status loads, or if it
 * cannot be read, only the link shows.
 */
import { usePublishingStatus } from '../../../lib/api/publishing';
import { GuardedLink } from './guarded-link';

const TIME_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function PublishStatusSlot() {
  const status = usePublishingStatus();
  const published = status.data?.published;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {status.isSuccess ? (
        <span className="text-neutral-300" data-testid="publish-status">
          {published
            ? `Version ${String(published.version)} live since ${TIME_FORMAT.format(new Date(published.publishedAt))}`
            : 'Never published'}
        </span>
      ) : null}
      {status.isSuccess && published && status.data.hasUnpublishedChanges ? (
        <span className="rounded-full bg-amber-300 px-2 py-0.5 text-xs font-semibold text-neutral-950">Unpublished changes</span>
      ) : null}
      <GuardedLink href="/cms/publish" className="rounded-full border border-neutral-700 px-3 py-1 text-neutral-300 hover:border-neutral-500">
        Publish
      </GuardedLink>
    </div>
  );
}
