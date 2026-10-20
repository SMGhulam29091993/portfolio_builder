'use client';
/**
 * The registration form (`cms-panel-shell.AC16`): display name, email and password, plus the
 * owner key only while the claim is open (`account-registration.API01`). Every address gets
 * the same confirmation; the next step is code entry. A refused owner key is shown on the key
 * field.
 */
import { registerRequestSchema, type RegisterRequest } from '@portfolio/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { GoogleButton } from '../../../../../components/cms/google-button';
import { Button, Notice, TextInput, TextLink } from '../../../../../components/cms/ui';
import { VerifyCodeStep } from '../../../../../components/cms/verify-code-step';
import { useRegister, useRegistrationOptions } from '../../../../../lib/api/auth';
import { ApiError } from '../../../../../lib/api/client';
import { genericErrorMessage } from '../../../../../lib/cms/messages';

type RegisterFormValues = z.input<typeof registerRequestSchema>;

export function RegisterForm() {
  const options = useRegistrationOptions();
  const registration = useRegister();
  const [reference, setReference] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError } = useForm<RegisterFormValues, unknown, RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      setReference((await registration.mutateAsync(values)).reference);
    } catch (error) {
      const code = error instanceof ApiError ? error.code : '';
      if (code === 'OWNER_CLAIM_REFUSED') setError('ownerSecret', { message: 'That owner key was not accepted.' });
      else if (code === 'OWNER_EXISTS') setError('ownerSecret', { message: 'The owner account has already been claimed.' });
      else setFailure(genericErrorMessage(error));
    }
  });

  if (reference) {
    return (
      <section aria-labelledby="verify-heading" className="flex flex-col gap-6">
        <h1 id="verify-heading" className="text-2xl font-semibold">Check your email</h1>
        <VerifyCodeStep initialReference={reference} />
      </section>
    );
  }

  return (
    <section aria-labelledby="register-heading" className="flex flex-col gap-6">
      <h1 id="register-heading" className="text-2xl font-semibold">Create your account</h1>
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <form onSubmit={(event) => void onSubmit(event)} method="post" noValidate className="flex flex-col gap-4">
        <TextInput label="Display name" autoComplete="name" error={formState.errors.displayName?.message} {...register('displayName')} />
        <TextInput label="Email" type="email" autoComplete="email" error={formState.errors.email?.message} {...register('email')} />
        <TextInput
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          error={formState.errors.password?.message}
          {...register('password')}
        />
        {options.data?.ownerClaimOpen ? (
          <TextInput
            label="Owner key (optional)"
            type="password"
            autoComplete="off"
            hint="Only the platform owner has this key. Leave it empty otherwise."
            error={formState.errors.ownerSecret?.message}
            {...register('ownerSecret')}
          />
        ) : null}
        <Button type="submit" busy={registration.isPending}>
          Create account
        </Button>
      </form>
      {options.data?.googleSignIn ? <GoogleButton /> : null}
      <TextLink href="/cms/login">Already have an account? Sign in</TextLink>
    </section>
  );
}
