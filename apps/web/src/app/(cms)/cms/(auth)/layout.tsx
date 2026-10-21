/**
 * Frame of the signed-out CMS screens — sign-in, registration, verification, password reset
 * (`cms-panel-shell.T02`): one centred card, no navigation. A browser that is still signed in
 * is sent on to the panel instead (`cms-panel-shell.AC21`).
 */
import type { ReactNode } from 'react';

import { SignedOutOnly } from '../../../../components/cms/signed-out-only';

export default function AuthLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-4 py-12 text-neutral-100">
      <div className="w-full max-w-md rounded-3xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-xl">
        <SignedOutOnly>{children}</SignedOutOnly>
      </div>
    </main>
  );
}
