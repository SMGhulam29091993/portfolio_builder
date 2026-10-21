'use client';
/**
 * `/cms/forgot-password` (`cms-panel-shell.AC15`): request a code by email
 * (`owner-auth.API05`, one confirmation for every address), then enter it with a new password
 * (`API07`); resend (`API06`) after the cooldown. The `reference` lives in component state
 * only, never in a URL or a log. Success leads to sign-in with a "password updated" notice.
 */
import { forgotPasswordRequestSchema, resetPasswordRequestSchema } from '@portfolio/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button, Notice, TextInput, TextLink } from '../../../../../components/cms/ui';
import { useCountdown } from '../../../../../components/cms/use-countdown';
import { useForgotPassword, useResendResetCode, useResetPassword } from '../../../../../lib/api/auth';
import { ApiError } from '../../../../../lib/api/client';
import { formatWait, genericErrorMessage } from '../../../../../lib/cms/messages';

const resetFormSchema = resetPasswordRequestSchema.pick({ otp: true, newPassword: true });
type EmailForm = z.input<typeof forgotPasswordRequestSchema>;
type ResetForm = z.input<typeof resetFormSchema>;

const RESEND_COOLDOWN_SEC = 60;

export default function ForgotPasswordPage() {
  const router = useRouter();
  const forgot = useForgotPassword();
  const resend = useResendResetCode();
  const reset = useResetPassword();
  const cooldown = useCountdown();
  const [reference, setReference] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success' | 'info'; text: string } | null>(null);
  const [expired, setExpired] = useState(false);
  const emailForm = useForm<EmailForm>({ resolver: zodResolver(forgotPasswordRequestSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetFormSchema) });

  const requestCode = emailForm.handleSubmit(async (values) => {
    setNotice(null);
    try {
      setReference((await forgot.mutateAsync(values)).reference);
      cooldown.start(RESEND_COOLDOWN_SEC);
      setNotice({ tone: 'info', text: 'If the address is registered, a code is on its way. It expires in 10 minutes.' });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') cooldown.start(error.retryAfterSec ?? 60);
      setNotice({ tone: 'error', text: genericErrorMessage(error) });
    }
  });

  const submitReset = resetForm.handleSubmit(async ({ otp, newPassword }) => {
    if (!reference) return;
    setNotice(null);
    try {
      await reset.mutateAsync({ reference, otp, newPassword });
      router.replace('/cms/login?notice=password-updated');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : '';
      if (code === 'OTP_INVALID') resetForm.setError('otp', { message: 'That code is not valid. Check it, or send a new one.' });
      else if (code === 'OTP_EXPIRED') {
        setExpired(true);
        resetForm.setError('otp', { message: 'That code has expired. Send a new one.' });
      } else setNotice({ tone: 'error', text: genericErrorMessage(error) });
    }
  });

  const onResend = async () => {
    if (!reference) return;
    setNotice(null);
    try {
      setReference((await resend.mutateAsync({ reference })).reference);
      setExpired(false);
      resetForm.reset({ otp: '', newPassword: resetForm.getValues('newPassword') });
      cooldown.start(RESEND_COOLDOWN_SEC);
      setNotice({ tone: 'success', text: 'A new code is on its way. Earlier codes no longer work.' });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') cooldown.start(error.retryAfterSec ?? 60);
      setNotice({ tone: 'error', text: genericErrorMessage(error) });
    }
  };

  return (
    <section aria-labelledby="forgot-heading" className="flex flex-col gap-6">
      <h1 id="forgot-heading" className="text-2xl font-semibold">Reset your password</h1>
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      {reference ? (
        <form onSubmit={(event) => void submitReset(event)} method="post" noValidate className="flex flex-col gap-4">
          <TextInput
            label="Code from the email"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            error={resetForm.formState.errors.otp?.message}
            {...resetForm.register('otp')}
          />
          <TextInput
            label="New password"
            type="password"
            autoComplete="new-password"
            hint="At least 12 characters."
            error={resetForm.formState.errors.newPassword?.message}
            {...resetForm.register('newPassword')}
          />
          <Button type="submit" busy={reset.isPending}>
            Set new password
          </Button>
          <Button variant="ghost" onClick={() => void onResend()} disabled={cooldown.remaining > 0} busy={resend.isPending}>
            {cooldown.remaining > 0 ? `Send a new code in ${formatWait(cooldown.remaining)}` : expired ? 'Send a new code (expired)' : 'Send a new code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={(event) => void requestCode(event)} method="post" noValidate className="flex flex-col gap-4">
          <TextInput label="Email" type="email" autoComplete="email" error={emailForm.formState.errors.email?.message} {...emailForm.register('email')} />
          <Button type="submit" busy={forgot.isPending} disabled={cooldown.remaining > 0}>
            {cooldown.remaining > 0 ? `Try again in ${formatWait(cooldown.remaining)}` : 'Send a code'}
          </Button>
        </form>
      )}
      <TextLink href="/cms/login">Back to sign in</TextLink>
    </section>
  );
}
