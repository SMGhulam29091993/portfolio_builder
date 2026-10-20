'use client';
/**
 * The signed-in CMS frame (`cms-panel-shell.T03`; AC1, AC4, AC8, AC11, AC12): loads the
 * signed-in user (`owner-auth.API04`) — an absent or dead session is sent to sign-in by the API
 * client's session-loss handler, with the current path as `next` — then renders the header,
 * the navigation and the page. Closing the tab with unsaved changes asks first (AC8).
 */
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

import { useLogout, useMe } from '../../../lib/api/auth';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { confirmDiscard, useCmsUi } from '../../../lib/cms/ui-store';
import { Button, Notice } from '../ui';
import { CmsNav } from './cms-nav';
import { PublishStatusSlot } from './publish-status-slot';
import { Toasts } from './toasts';

export function PanelShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const me = useMe();
  const logout = useLogout();
  const dirtyCount = useCmsUi((state) => state.dirty.size);

  useEffect(() => {
    if (dirtyCount === 0) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      // Current browsers show their own generic prompt; `preventDefault` is what asks for it.
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [dirtyCount]);

  const signOut = async () => {
    if (!confirmDiscard()) return;
    await logout.mutateAsync().catch(() => undefined);
    router.replace('/cms/login?notice=signed-out');
  };

  if (me.isPending) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 text-neutral-300">
        <p role="status">Loading your workspace…</p>
      </main>
    );
  }

  if (me.isError) {
    // A 401 is already on its way to the sign-in page; anything else gets a retry.
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4">
        <div className="flex max-w-md flex-col gap-4">
          <Notice tone="error">{genericErrorMessage(me.error)}</Notice>
          <Button onClick={() => void me.refetch()}>Retry</Button>
        </div>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-950 text-neutral-100">
      <aside className="hidden w-60 shrink-0 border-r border-neutral-800 p-4 lg:block">
        <p className="px-3 pb-6 text-sm font-semibold tracking-wide text-neutral-200">Portfolio Builder</p>
        <CmsNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-neutral-800 px-6 py-3">
          <details className="lg:hidden">
            <summary className="cursor-pointer rounded px-2 py-1 text-sm text-neutral-300">Menu</summary>
            <div className="absolute z-40 mt-2 w-64 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
              <CmsNav />
            </div>
          </details>
          <PublishStatusSlot />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-neutral-400 sm:inline">{me.data.displayName}</span>
            <Button variant="secondary" onClick={() => void signOut()} busy={logout.isPending}>
              Sign out
            </Button>
          </div>
        </header>
        <main id="cms-main" className="flex-1 overflow-auto px-6 py-6">
          {children}
        </main>
      </div>
      <Toasts />
    </div>
  );
}
