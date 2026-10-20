'use client';
/**
 * `/cms/verify` — for a user who lost their code (`cms-panel-shell.AC17`): ask for a new one by
 * email (`account-registration.API04`, the same answer for every address), then enter it.
 */
import { verificationCodeRequestSchema } from '@portfolio/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { Button, Notice, TextInput, TextLink } from '../../../../../components/cms/ui';
import { VerifyCodeStep } from '../../../../../components/cms/verify-code-step';
import { useRequestVerificationCode } from '../../../../../lib/api/auth';
import { genericErrorMessage } from '../../../../../lib/cms/messages';

type EmailForm = z.input<typeof verificationCodeRequestSchema>;

export default function VerifyPage() {
  const requestCode = useRequestVerificationCode();
  const [reference, setReference] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<EmailForm>({ resolver: zodResolver(verificationCodeRequestSchema) });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      setReference((await requestCode.mutateAsync(values)).reference);
    } catch (error) {
      setFailure(genericErrorMessage(error));
    }
  });

  return (
    <section aria-labelledby="verify-heading" className="flex flex-col gap-6">
      <h1 id="verify-heading" className="text-2xl font-semibold">Verify your email</h1>
      {reference ? (
        <VerifyCodeStep initialReference={reference} />
      ) : (
        <>
          {failure ? <Notice tone="error">{failure}</Notice> : null}
          <form onSubmit={(event) => void onSubmit(event)} method="post" noValidate className="flex flex-col gap-4">
            <TextInput label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
            <Button type="submit" busy={requestCode.isPending}>
              Send a code
            </Button>
          </form>
        </>
      )}
      <TextLink href="/cms/login">Back to sign in</TextLink>
    </section>
  );
}
