'use client';
/**
 * A confirmation step (`publish-pipeline.AC19`): nothing happens until the owner presses the
 * confirm button. A native modal `<dialog>`, so focus is trapped and Escape cancels.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button } from './ui';

export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Per instance: two dialogs on one screen must not share the title id they are labelled by.
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-900 p-6 text-neutral-100 backdrop:bg-black/70"
    >
      <h2 id={titleId} className="text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 flex flex-col gap-3 text-sm text-neutral-300">{children}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} busy={busy}>
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
