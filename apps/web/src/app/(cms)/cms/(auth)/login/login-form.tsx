'use client';
/**
 * The sign-in form (`cms-panel-shell.AC2`, `AC18`, `AC19`). One generic message for a wrong
 * email or password; a 429 disables submit for the wait the API names; a right password on an
 * unverified account offers a fresh code and moves to code entry. The password never leaves
 * the request body: the form posts with JavaScript and never puts values in the URL.
 */
import { loginRequestSchema } from '@portfolio/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { GoogleButton } from '../../../../../components/cms/google-button';
import { Button, Notice, TextInput, TextLink } from '../../../../../components/cms/ui';
import { useCountdown } from '../../../../../components/cms/use-countdown';
import { VerifyCodeStep } from '../../../../../components/cms/verify-code-step';
import { useLogin, useRegistrationOptions, useRequestVerificationCode } from '../../../../../lib/api/auth';
import { ApiError } from '../../../../../lib/api/client';
import { formatWait, genericErrorMessage, googleErrorMessage } from '../../../../../lib/cms/messages';

type LoginForm = z.input<typeof loginRequestSchema>;

const NOTICES: Readonly<Record<string, string>> = {
  'signed-out-elsewhere': 'You were signed out because your account signed in somewhere else.',
  'password-updated': 'Your password was updated. Sign in with the new one.',
  'signed-out': 'You have signed out.',
};

export function LoginForm({ next, notice, googleError }: { next: string; notice?: string; googleError?: string }) {
  const router = useRouter();
  const login = useLogin();
  const options = useRegistrationOptions();
  const requestCode = useRequestVerificationCode();
  const wait = useCountdown();
  const [failure, setFailure] = useState<string | null>(null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);
  const { register, handleSubmit, formState, resetField } = useForm<LoginForm>({
    resolver: zodResolver(loginRequestSchema),
  });

  const onSubmit = handleSubmit(async (credentials) => {
    setFailure(null);
    setUnverifiedEmail(null);
    try {
      await login.mutateAsync(credentials);
      router.replace(next);
    } catch (error) {
      resetField('password');
      if (!(error instanceof ApiError)) { setFailure(genericErrorMessage(error)); return; }
      if (error.code === 'UNAUTHENTICATED') { setFailure('The email or password is incorrect.'); return; }
      if (error.code === 'EMAIL_NOT_VERIFIED') { setUnverifiedEmail(credentials.email); return; }
      if (error.code === 'RATE_LIMITED') wait.start(error.retryAfterSec ?? 60);
      setFailure(genericErrorMessage(error));
    }
  });

  const sendCode = async () => {
    if (!unverifiedEmail) return;
    try {
      setReference((await requestCode.mutateAsync({ email: unverifiedEmail })).reference);
    } catch (error) {
      setFailure(genericErrorMessage(error));
    }
  };

  if (reference) {
    return (
      <section aria-labelledby="verify-heading" className="flex flex-col gap-6">
        <h1 id="verify-heading" className="text-2xl font-semibold">Verify your email</h1>
        <VerifyCodeStep initialReference={reference} />
      </section>
    );
  }

  return (
    <section aria-labelledby="login-heading" className="flex flex-col gap-6">
      <h1 id="login-heading" className="text-2xl font-semibold">Sign in</h1>
      {notice && NOTICES[notice] ? <Notice tone="info">{NOTICES[notice]}</Notice> : null}
      {googleError ? <Notice tone="error">{googleErrorMessage(googleError)}</Notice> : null}
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      {unverifiedEmail ? (
        <Notice tone="info">
          <p>Your email address is not verified yet.</p>
          <Button variant="secondary" className="mt-2" onClick={() => void sendCode()} busy={requestCode.isPending}>
            Send a new code
          </Button>
        </Notice>
      ) : null}
      <form onSubmit={(event) => void onSubmit(event)} method="post" noValidate className="flex flex-col gap-4">
        <TextInput label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <TextInput
          label="Password"
          type="password"
          autoComplete="current-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" busy={login.isPending} disabled={wait.remaining > 0}>
          {wait.remaining > 0 ? `Try again in ${formatWait(wait.remaining)}` : 'Sign in'}
        </Button>
      </form>
      {options.data?.googleSignIn ? <GoogleButton /> : null}
      <div className="flex flex-wrap justify-between gap-2">
        <TextLink href="/cms/forgot-password">Forgot your password?</TextLink>
        <TextLink href="/cms/register">Create an account</TextLink>
      </div>
    </section>
  );
}
