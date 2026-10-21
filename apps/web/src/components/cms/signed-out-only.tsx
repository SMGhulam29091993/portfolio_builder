'use client';
/**
 * The guard around the signed-out CMS screens (`cms-panel-shell.AC21`): a browser that still
 * has a session is sent on to `next` (or `/cms`) instead of seeing a sign-in form again.
 *
 * The session cookies are `Path=/api/v1`, so no page request can see them (spec → Status,
 * T02 deviation); the check is `owner-auth.API04` through the API client, which refreshes an
 * expired access token first — so a session older than the 15-minute token still counts.
 *
 * - It decides once, on the first answer. After "signed out" the screen owns navigation, so a
 *   sign-in or a verified code made here is not redirected twice.
 * - A `?notice=` means the session has just ended (signed out, signed in elsewhere, password
 *   updated), so it does not ask at all — and sends no refresh the API would only refuse.
 * - Any failure, a 5xx included, shows the screen: the form reports its own errors.
 */
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ReactNode } from 'react';

import { useMe } from '../../lib/api/auth';
import { safeNext } from '../../lib/cms/navigation';

export function SignedOutOnly({ children }: { children: ReactNode }) {
  // `useSearchParams` needs a boundary on a statically rendered page; the server sends the
  // fallback and the browser runs the check.
  return (
    <Suspense fallback={<SessionStatus />}>
      <SessionGate>{children}</SessionGate>
    </Suspense>
  );
}

function SessionGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  // The router's view of the query, not `window.location`: right after a client-side
  // `router.replace` the window still shows the previous URL while this renders.
  const params = useSearchParams();
  const justSignedOut = params.has('notice');
  const me = useMe({ enabled: !justSignedOut });
  const [signedOut, setSignedOut] = useState(false);

  // Recorded during render, the first time the check fails, so it can never flip back.
  if (me.isError && !signedOut) setSignedOut(true);

  const signedIn = !signedOut && !justSignedOut && me.isSuccess;
  const next = params.get('next');

  useEffect(() => {
    if (signedIn) router.replace(safeNext(next));
  }, [signedIn, next, router]);

  if (signedOut || justSignedOut) return <>{children}</>;

  return <SessionStatus opening={signedIn} />;
}

function SessionStatus({ opening = false }: { opening?: boolean }) {
  return (
    <p role="status" className="text-center text-sm text-neutral-300">
      {opening ? 'Opening your workspace…' : 'Checking your session…'}
    </p>
  );
}
