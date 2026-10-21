'use client';
/**
 * `/cms/publish` (`publish-pipeline.T09`; AC19): what is live, what the publish rules say about
 * the draft — grouped by severity, each issue linked to the screen that fixes it — a Publish
 * button that stays disabled while any error exists, a confirmation step with an optional note,
 * and the version history with a confirmed "Make live" per older version.
 */
import type { PublishIssue, SnapshotSummary } from '@portfolio/contracts';
import { useState } from 'react';

import { ApiError } from '../../../lib/api/client';
import {
  useActivateSnapshot,
  useDraftValidation,
  usePublish,
  usePublishingStatus,
  useRevalidate,
  useSnapshotHistory,
} from '../../../lib/api/publishing';
import { groupIssues, issueHref, issueLocation } from '../../../lib/cms/issue-links';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { useCmsUi } from '../../../lib/cms/ui-store';
import { ConfirmDialog } from '../confirm-dialog';
import { Button, Notice, TextLink } from '../ui';

/** Longest note the API accepts (`publish-pipeline.API03`). */
const NOTE_MAX_LENGTH = 200;

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

/** What a failed publish or activation means to the owner. */
const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  DRAFT_CHANGED: 'The draft changed since it was checked. Review the checks and publish again.',
  NOTHING_TO_PUBLISH: 'The live site already shows this draft.',
  PUBLISH_CONFLICT: 'Another publish changed the live version first. Review and try again.',
  PUBLISH_BLOCKED: 'The draft has problems that must be fixed first.',
  ALREADY_CURRENT: 'That version is already live.',
};

function failureMessage(error: unknown): string {
  return error instanceof ApiError ? (CONFLICT_MESSAGES[error.code] ?? genericErrorMessage(error)) : genericErrorMessage(error);
}

export function PublishScreen() {
  const status = usePublishingStatus();
  const validation = useDraftValidation();
  const history = useSnapshotHistory();
  const publish = usePublish();
  const activate = useActivateSnapshot();
  const revalidate = useRevalidate();
  const notify = useCmsUi((state) => state.notify);
  const [confirming, setConfirming] = useState(false);
  const [note, setNote] = useState('');
  const [activating, setActivating] = useState<SnapshotSummary | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const issues = groupIssues(validation.data?.issues ?? []);
  const hasChanges = status.data?.hasUnpublishedChanges ?? false;
  const canPublish = validation.isSuccess && !validation.isFetching && issues.errors.length === 0 && hasChanges;

  const runPublish = async () => {
    if (!validation.data) return;
    setFailure(null);
    try {
      const trimmed = note.trim();
      const result = await publish.mutateAsync({
        expectedDraftHash: validation.data.draftContentHash,
        ...(trimmed ? { note: trimmed } : {}),
      });
      setConfirming(false);
      setNote('');
      notify('success', `Version ${String(result.snapshot.version)} is live.`);
    } catch (error) {
      setConfirming(false);
      setFailure(failureMessage(error));
    }
  };

  const runActivate = async () => {
    if (!activating) return;
    setFailure(null);
    try {
      const result = await activate.mutateAsync(activating.version);
      notify('success', `Version ${String(result.snapshot.version)} is live.`);
    } catch (error) {
      setFailure(failureMessage(error));
    }
    setActivating(null);
  };

  const runRevalidate = async () => {
    setFailure(null);
    try {
      const { revalidation } = await revalidate.mutateAsync();
      notify(revalidation === 'ok' ? 'success' : 'error', revalidation === 'ok' ? 'The site was refreshed.' : 'The site still could not be refreshed.');
    } catch (error) {
      setFailure(failureMessage(error));
    }
  };

  return (
    <section aria-labelledby="publish-heading" className="flex max-w-3xl flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="publish-heading" className="text-2xl font-semibold">
          Publish
        </h1>
        <Button onClick={() => {
            setConfirming(true);
          }} disabled={!canPublish} busy={publish.isPending}>
          Publish
        </Button>
      </div>

      {failure ? <Notice tone="error">{failure}</Notice> : null}

      <StatusPanel
        status={status}
        retrying={revalidate.isPending}
        onRetry={() => void runRevalidate()}
      />

      <section aria-labelledby="checks-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="checks-heading" className="text-lg font-semibold">
            Checks
          </h2>
          <Button variant="secondary" onClick={() => void validation.refetch()} busy={validation.isFetching}>
            Check again
          </Button>
        </div>
        {validation.isPending ? <p role="status">Checking the draft…</p> : null}
        {validation.isError ? <Notice tone="error">{genericErrorMessage(validation.error)}</Notice> : null}
        {validation.isSuccess && validation.data.issues.length === 0 ? (
          <Notice tone="success">No problems found.</Notice>
        ) : null}
        <IssueGroup title="Must fix before publishing" issues={issues.errors} tone="error" />
        <IssueGroup title="Worth a look" issues={issues.warnings} tone="warning" />
        {validation.isSuccess && issues.errors.length === 0 && !hasChanges && status.data?.published ? (
          <p className="text-sm text-neutral-300">The live site already shows this draft.</p>
        ) : null}
      </section>

      <HistoryPanel history={history} onMakeLive={setActivating} busy={activate.isPending} />

      <ConfirmDialog
        open={confirming}
        title="Publish this draft?"
        confirmLabel="Publish now"
        busy={publish.isPending}
        onCancel={() => {
          setConfirming(false);
        }}
        onConfirm={() => void runPublish()}
      >
        <p>Visitors will see this version as soon as it is published. You can switch back to an earlier version at any time.</p>
        {issues.warnings.length > 0 ? (
          <p>{`${String(issues.warnings.length)} warning${issues.warnings.length === 1 ? '' : 's'} will be published as they are.`}</p>
        ) : null}
        <label className="flex flex-col gap-1 text-neutral-200">
          Note (optional)
          <textarea
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            rows={3}
            onChange={(event) => {
              setNote(event.target.value);
            }}
            className="rounded-lg border border-neutral-600 bg-neutral-950 px-3 py-2 text-neutral-100"
          />
        </label>
      </ConfirmDialog>

      <ConfirmDialog
        open={activating !== null}
        title={`Make version ${String(activating?.version ?? '')} live?`}
        confirmLabel="Make live"
        busy={activate.isPending}
        onCancel={() => {
          setActivating(null);
        }}
        onConfirm={() => void runActivate()}
      >
        <p>Visitors will see this version instead of the current one. Your draft does not change.</p>
      </ConfirmDialog>
    </section>
  );
}

function StatusPanel({
  status,
  retrying,
  onRetry,
}: {
  status: ReturnType<typeof usePublishingStatus>;
  retrying: boolean;
  onRetry: () => void;
}) {
  if (status.isPending) return <p role="status">Loading the publishing status…</p>;
  if (status.isError) return <Notice tone="error">{genericErrorMessage(status.error)}</Notice>;
  const { published, hasUnpublishedChanges, revalidation } = status.data;
  return (
    <section aria-labelledby="status-heading" className="flex flex-col gap-2 rounded-2xl border border-neutral-700 p-4">
      <h2 id="status-heading" className="text-lg font-semibold">
        Status
      </h2>
      <p className="text-sm text-neutral-200">
        {published
          ? `Version ${String(published.version)} is live, since ${DATE_FORMAT.format(new Date(published.publishedAt))}.`
          : 'Nothing is published yet.'}
      </p>
      <p className="text-sm text-neutral-300">
        {hasUnpublishedChanges ? 'The draft has changes that are not published.' : 'The live site matches the draft.'}
      </p>
      {revalidation?.status === 'failed' ? (
        <Notice tone="error">
          <p>The live site could not be refreshed, so visitors may still see the previous version for a while.</p>
          <Button variant="secondary" className="mt-2" onClick={onRetry} busy={retrying}>
            Refresh the site
          </Button>
        </Notice>
      ) : null}
    </section>
  );
}

function IssueGroup({ title, issues, tone }: { title: string; issues: readonly PublishIssue[]; tone: 'error' | 'warning' }) {
  if (issues.length === 0) return null;
  const headingId = `issues-${tone}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className={`text-sm font-semibold ${tone === 'error' ? 'text-red-300' : 'text-amber-200'}`}>
        {`${title} (${String(issues.length)})`}
      </h3>
      <ul className="flex flex-col gap-2">
        {issues.map((issue) => (
          <li key={`${issue.rule}:${issue.path}`} className="rounded-lg border border-neutral-700 px-3 py-2">
            <p className="text-sm text-neutral-100">{issue.message}</p>
            <p className="text-xs text-neutral-400">{issueLocation(issue.path)}</p>
            <TextLink href={issueHref(issue.path)}>{`Fix: ${issueLocation(issue.path)}`}</TextLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HistoryPanel({
  history,
  onMakeLive,
  busy,
}: {
  history: ReturnType<typeof useSnapshotHistory>;
  onMakeLive: (snapshot: SnapshotSummary) => void;
  busy: boolean;
}) {
  return (
    <section aria-labelledby="history-heading" className="flex flex-col gap-3">
      <h2 id="history-heading" className="text-lg font-semibold">
        History
      </h2>
      {history.isPending ? <p role="status">Loading the history…</p> : null}
      {history.isError ? <Notice tone="error">{genericErrorMessage(history.error)}</Notice> : null}
      {history.isSuccess && history.data.snapshots.length === 0 ? (
        <p className="text-sm text-neutral-300">No version has been published yet.</p>
      ) : null}
      {history.isSuccess && history.data.snapshots.length > 0 ? (
        <ol className="flex flex-col gap-2" aria-label="Published versions">
          {history.data.snapshots.map((snapshot) => (
            <li
              key={snapshot.version}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-700 px-3 py-2"
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-neutral-100">{`Version ${String(snapshot.version)}`}</span>
                <span className="text-xs text-neutral-400">{DATE_FORMAT.format(new Date(snapshot.publishedAt))}</span>
                {snapshot.note ? <span className="text-sm text-neutral-300">{snapshot.note}</span> : null}
              </div>
              {snapshot.isCurrent ? (
                <span className="rounded-full bg-lime-300 px-3 py-1 text-xs font-semibold text-neutral-950">Live</span>
              ) : (
                <Button variant="secondary" onClick={() => {
                    onMakeLive(snapshot);
                  }} disabled={busy} aria-label={`Make version ${String(snapshot.version)} live`}>
                  Make live
                </Button>
              )}
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
