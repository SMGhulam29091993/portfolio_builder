'use client';
/**
 * The email-verification code step (`cms-panel-shell.AC17`), shared by registration, an
 * unverified sign-in and `/cms/verify`. The `reference` lives in this component's state only —
 * never in a URL, a cache or a log (`cms-panel-shell.AC15`). The right code signs the user in
 * (`account-registration.API03`) and lands them on the CMS.
 */
import { verifyEmailRequestSchema } from '@portfolio/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ApiError } from '../../lib/api/client';
import { useResendVerificationCode, useVerifyEmail } from '../../lib/api/auth';
import { formatWait, genericErrorMessage } from '../../lib/cms/messages';
import { Button, Notice, TextInput } from './ui';
import { useCountdown } from './use-countdown';

const codeSchema = verifyEmailRequestSchema.pick({ otp: true });
type CodeForm = z.input<typeof codeSchema>;

/** The resend cooldown the API enforces, so the button can wait it out up front. */
const RESEND_COOLDOWN_SEC = 60;

export function VerifyCodeStep({ initialReference }: { initialReference: string }) {
  const router = useRouter();
  const [reference, setReference] = useState(initialReference);
  const [notice, setNotice] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const verify = useVerifyEmail();
  const resend = useResendVerificationCode();
  const cooldown = useCountdown();
  const { register, handleSubmit, formState, setError, reset } = useForm<CodeForm>({
    resolver: zodResolver(codeSchema),
  });

  const onSubmit = handleSubmit(async ({ otp }) => {
    setNotice(null);
    try {
      await verify.mutateAsync({ reference, otp });
      router.replace('/cms');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : '';
      if (code === 'OTP_INVALID') setError('otp', { message: 'That code is not valid. Check it, or send a new one.' });
      else if (code === 'OTP_EXPIRED') setError('otp', { message: 'That code has expired. Send a new one.' });
      else setNotice({ tone: 'error', text: genericErrorMessage(error) });
    }
  });

  const onResend = async () => {
    setNotice(null);
    try {
      const issued = await resend.mutateAsync({ reference });
      setReference(issued.reference);
      reset({ otp: '' });
      cooldown.start(RESEND_COOLDOWN_SEC);
      setNotice({ tone: 'success', text: 'A new code is on its way. Earlier codes no longer work.' });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'RATE_LIMITED') cooldown.start(error.retryAfterSec ?? RESEND_COOLDOWN_SEC);
      setNotice({ tone: 'error', text: genericErrorMessage(error) });
    }
  };

  return (
    <form onSubmit={(event) => void onSubmit(event)} method="post" noValidate className="flex flex-col gap-4">
      <p className="text-sm text-neutral-300">
        We sent a 6-digit code to your email. It expires in 10 minutes.
      </p>
      {notice ? <Notice tone={notice.tone}>{notice.text}</Notice> : null}
      <TextInput
        label="Verification code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        error={formState.errors.otp?.message}
        {...register('otp')}
      />
      <Button type="submit" busy={verify.isPending}>
        Verify and continue
      </Button>
      <Button variant="ghost" onClick={() => void onResend()} disabled={cooldown.remaining > 0} busy={resend.isPending}>
        {cooldown.remaining > 0 ? `Send a new code in ${formatWait(cooldown.remaining)}` : 'Send a new code'}
      </Button>
    </form>
  );
}
