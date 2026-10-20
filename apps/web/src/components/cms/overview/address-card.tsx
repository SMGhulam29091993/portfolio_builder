'use client';
/**
 * The portfolio's public address and its slug (`cms-panel-shell.AC20`; `section-engine.API06`).
 * The CMS is served from the platform's own origin, so the free address is that origin plus
 * the slug (ADR-0010 → Owner answers: a path, `<platform>/<slug>`).
 */
import { changeSlugRequestSchema } from '@portfolio/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ApiError } from '../../../lib/api/client';
import { useChangeSlug } from '../../../lib/api/portfolio';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { useCmsUi } from '../../../lib/cms/ui-store';
import { Button, Notice, TextInput } from '../ui';

const slugFormSchema = changeSlugRequestSchema.pick({ slug: true });
type SlugForm = z.input<typeof slugFormSchema>;

export function AddressCard({ slug, revision }: { slug: string; revision: number }) {
  const [origin, setOrigin] = useState('');
  const changeSlug = useChangeSlug();
  const notify = useCmsUi((state) => state.notify);
  const [failure, setFailure] = useState<string | null>(null);
  const { register, handleSubmit, formState, setError, reset } = useForm<SlugForm>({
    resolver: zodResolver(slugFormSchema),
    defaultValues: { slug },
    mode: 'onChange',
  });

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  useEffect(() => {
    reset({ slug });
  }, [reset, slug]);

  const onSubmit = handleSubmit(async (values) => {
    setFailure(null);
    try {
      const portfolio = await changeSlug.mutateAsync({ expectedRevision: revision, slug: values.slug });
      notify('success', `Your address is now ${origin}/${portfolio.slug}`);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'SLUG_TAKEN') {
        setError('slug', { message: 'That address is taken. Choose another.' });
      } else if (error instanceof ApiError && error.code === 'REVISION_CONFLICT') {
        setFailure('The portfolio changed elsewhere. The page has the latest version; try again.');
      } else {
        setFailure(genericErrorMessage(error));
      }
    }
  });

  const address = `${origin}/${slug}`;
  return (
    <section aria-labelledby="address-heading" className="flex flex-col gap-4 rounded-2xl border border-neutral-800 p-5">
      <h2 id="address-heading" className="text-lg font-semibold">Your address</h2>
      <p className="text-sm text-neutral-300">
        Your portfolio is served at{' '}
        <a href={address} className="text-lime-300 underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
          {address}
        </a>{' '}
        once you publish it.
      </p>
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <TextInput
            label="Address name"
            hint="3–40 lower-case letters, digits and single hyphens."
            autoComplete="off"
            error={formState.errors.slug?.message}
            {...register('slug')}
          />
        </div>
        <Button type="submit" disabled={!formState.isDirty || !formState.isValid} busy={changeSlug.isPending}>
          Change address
        </Button>
      </form>
    </section>
  );
}
