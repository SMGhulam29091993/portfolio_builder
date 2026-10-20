'use client';
/**
 * The copy-email chip (`contact-section.T02`; AC6, AC7): copies the address, announces "Copied"
 * through a polite live region and shows it for two seconds; without a clipboard it selects the
 * address so it can be copied by hand, and never throws. A long address is truncated visually
 * while its accessible name stays the full address.
 */
import { useRef, useState } from 'react';

import { CopyIcon } from '../shared/index.js';

const COPIED_MS = 2_000;

export function CopyEmailChip({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  const text = useRef<HTMLSpanElement>(null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, COPIED_MS);
    } catch {
      // No clipboard (insecure context, denied permission): select the text instead.
      const node = text.current;
      const selection = window.getSelection();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  };

  return (
    <span className="inline-flex min-w-0 max-w-full items-center">
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${email}`}
        className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-border px-4 py-3 font-mono text-sm text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span ref={text} className="truncate">{copied ? 'Copied' : email}</span>
        <CopyIcon className="h-4 w-4 shrink-0" />
      </button>
      <span role="status" aria-live="polite" className="sr-only">{copied ? 'Copied' : ''}</span>
    </span>
  );
}
