'use client';
/**
 * Cross-component CMS UI state (`int-standards.nextjs.md` → State and data: Zustand only for
 * UI state, never a mirror of server data). Holds the toast queue, the unsaved-changes
 * registry (`cms-panel-shell.AC8`) and the preview viewport (`AC9`).
 */
import { create } from 'zustand';

export interface Toast {
  readonly id: number;
  readonly tone: 'success' | 'error' | 'info';
  readonly text: string;
}

/** The two reference widths the preview switches between. */
export type PreviewViewport = 'desktop' | 'mobile';

interface CmsUiState {
  readonly toasts: readonly Toast[];
  /** Editors with unsaved changes, by a stable key (e.g. `section:about`). */
  readonly dirty: ReadonlySet<string>;
  readonly viewport: PreviewViewport;
  /** Whether the preview pane is open on narrow screens. */
  readonly previewOpen: boolean;
  notify: (tone: Toast['tone'], text: string) => void;
  dismiss: (id: number) => void;
  setDirty: (key: string, dirty: boolean) => void;
  setViewport: (viewport: PreviewViewport) => void;
  setPreviewOpen: (open: boolean) => void;
}

let nextToastId = 1;

export const useCmsUi = create<CmsUiState>()((set) => ({
  toasts: [],
  dirty: new Set<string>(),
  viewport: 'desktop',
  previewOpen: false,
  notify: (tone, text) => {
    const toast = { id: nextToastId++, tone, text };
    set((state) => ({ toasts: [...state.toasts, toast] }));
  },
  dismiss: (id) => {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },
  setDirty: (key, dirty) => {
    set((state) => {
      if (state.dirty.has(key) === dirty) return state;
      const next = new Set(state.dirty);
      if (dirty) next.add(key);
      else next.delete(key);
      return { dirty: next };
    });
  },
  setViewport: (viewport) => {
    set({ viewport });
  },
  setPreviewOpen: (previewOpen) => {
    set({ previewOpen });
  },
}));

/** The confirmation text shown before unsaved changes are discarded (AC8). */
export const DISCARD_CHANGES_PROMPT = 'You have unsaved changes. Leave and discard them?';

/** `true` when nothing is dirty, or the user confirms discarding (AC8). */
export function confirmDiscard(): boolean {
  if (useCmsUi.getState().dirty.size === 0) return true;
  return window.confirm(DISCARD_CHANGES_PROMPT);
}
