'use client';
/**
 * The revision-conflict dialog (`cms-panel-shell.AC7`): someone saved this section elsewhere.
 * Nothing is overwritten without an explicit choice — "Load latest" discards local edits;
 * "Overwrite with mine" resubmits against the current revision. A native modal `<dialog>`, so
 * focus is trapped and Escape cancels (which keeps editing, choosing neither).
 */
import { useEffect, useRef } from 'react';

import { Button } from '../ui';

export function ConflictDialog({
  open,
  onLoadLatest,
  onOverwrite,
  onCancel,
  busy,
}: {
  open: boolean;
  onLoadLatest: () => void;
  onOverwrite: () => void;
  onCancel: () => void;
  busy: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="conflict-title"
      aria-describedby="conflict-body"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 text-neutral-100 backdrop:bg-black/70"
    >
      <h2 id="conflict-title" className="text-lg font-semibold">
        This section changed elsewhere
      </h2>
      <p id="conflict-body" className="mt-2 text-sm text-neutral-300">
        It was saved from another tab or device after you opened it. Load the latest version, or
        overwrite it with your changes.
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Keep editing
        </Button>
        <Button variant="secondary" onClick={onLoadLatest} disabled={busy}>
          Load latest
        </Button>
        <Button variant="danger" onClick={onOverwrite} busy={busy}>
          Overwrite with mine
        </Button>
      </div>
    </dialog>
  );
}
