'use client';
/**
 * The toast region (`cms-panel-shell.AC5`: "a confirmation is announced"). A polite live region,
 * so screen readers announce each message without moving focus; each toast dismisses itself
 * after a few seconds or on its close button.
 */
import { useEffect } from 'react';

import { useCmsUi, type Toast } from '../../../lib/cms/ui-store';
import { focusRing } from '../ui';

const TOAST_MS = 5_000;

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useCmsUi((state) => state.dismiss);
  useEffect(() => {
    const timer = setTimeout(() => {
      dismiss(toast.id);
    }, TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [dismiss, toast.id]);
  const tone = {
    success: 'border-lime-300/50 text-lime-100',
    error: 'border-red-400/60 text-red-100',
    info: 'border-neutral-600 text-neutral-100',
  }[toast.tone];
  return (
    <li className={`flex items-start gap-3 rounded-xl border bg-neutral-900 px-4 py-3 text-sm shadow-lg ${tone}`}>
      <span className="flex-1">{toast.text}</span>
      <button type="button" onClick={() => { dismiss(toast.id); }} className={`rounded text-neutral-400 hover:text-white ${focusRing}`}>
        <span aria-hidden="true">×</span>
        <span className="sr-only">Dismiss</span>
      </button>
    </li>
  );
}

export function Toasts() {
  const toasts = useCmsUi((state) => state.toasts);
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-4 right-4 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <ul className="pointer-events-auto flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </ul>
    </div>
  );
}
