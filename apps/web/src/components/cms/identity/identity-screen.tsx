'use client';
/**
 * `/cms/identity` (`site-identity.T07`; AC10): one form over the whole identity, validated with
 * the same `identitySchema` the API uses. The résumé and social-image selects offer only
 * uploaded assets of the right kind (and "None"). Saving follows the shell's rules: Save when
 * dirty and valid, a 400 attached to its fields, a 409 through the conflict dialog.
 */
import { identitySchema, SOCIAL_PLATFORMS, type CmsIdentity, type Identity } from '@portfolio/contracts';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useAssets } from '../../../lib/api/assets';
import { ApiError } from '../../../lib/api/client';
import { identityKeys, useIdentity, useSaveIdentity } from '../../../lib/api/identity';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { useCmsUi } from '../../../lib/cms/ui-store';
import { ConflictDialog } from '../editor/conflict-dialog';
import { applyServerIssues, issuesOf } from '../editor/server-errors';
import {
  FormSchemaProvider,
  ListField,
  SelectField,
  SwitchField,
  TagListField,
  TextAreaField,
  TextField,
} from '../form';
import { Button, Notice } from '../ui';

type IdentityInput = z.input<typeof identitySchema>;

const PLATFORM_LABELS: Readonly<Record<(typeof SOCIAL_PLATFORMS)[number], string>> = {
  github: 'GitHub',
  linkedin: 'LinkedIn',
  x: 'X',
  website: 'Website',
};

export function IdentityScreen() {
  const identity = useIdentity();
  if (identity.isPending) return <p role="status">Loading your identity…</p>;
  if (identity.isError) {
    return (
      <div className="flex max-w-md flex-col gap-3">
        <Notice tone="error">{genericErrorMessage(identity.error)}</Notice>
        <Button onClick={() => void identity.refetch()}>Retry</Button>
      </div>
    );
  }
  return <IdentityForm initial={identity.data} />;
}

function IdentityForm({ initial }: { initial: CmsIdentity }) {
  const queryClient = useQueryClient();
  const save = useSaveIdentity();
  const resumes = useAssets('resume');
  const images = useAssets('image');
  const notify = useCmsUi((state) => state.notify);
  const setDirty = useCmsUi((state) => state.setDirty);
  const [revision, setRevision] = useState(initial.revision);
  const [conflict, setConflict] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm<IdentityInput, unknown, Identity>({
    resolver: zodResolver(identitySchema),
    defaultValues: initial.data,
    mode: 'onChange',
  });
  const { formState, handleSubmit, reset, setError, setFocus } = form;

  useEffect(() => {
    setDirty('identity', formState.isDirty);
    return () => {
      setDirty('identity', false);
    };
  }, [formState.isDirty, setDirty]);

  const submit = async (data: Identity, expectedRevision: number) => {
    setFailure(null);
    try {
      const saved = await save.mutateAsync({ expectedRevision, data });
      setRevision(saved.revision);
      setConflict(null);
      reset(saved.data);
      notify('success', 'Identity saved.');
    } catch (error) {
      if (error instanceof ApiError && error.code === 'REVISION_CONFLICT') {
        const current = error.data.currentRevision;
        setConflict(typeof current === 'number' ? current : revision);
        return;
      }
      if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') {
        const first = applyServerIssues(issuesOf(error.data), (path, issue) => {
          setError(path as never, issue);
        });
        if (first) {
          setFocus(first as never);
          return;
        }
      }
      setFailure(genericErrorMessage(error));
    }
  };

  const onSubmit = handleSubmit((data) => submit(data, revision));
  const overwrite = handleSubmit((data) => submit(data, conflict ?? revision));
  const loadLatest = async () => {
    await queryClient.invalidateQueries({ queryKey: identityKeys.draft });
    const latest = queryClient.getQueryData<CmsIdentity>(identityKeys.draft);
    if (latest) {
      setRevision(latest.revision);
      reset(latest.data);
    }
    setConflict(null);
  };

  const assetOptions = (list: typeof resumes.data) => [
    { value: null, label: 'None' },
    ...(list ?? []).map((asset) => ({ value: asset.id, label: asset.filename })),
  ];

  return (
    <section aria-labelledby="identity-heading" className="flex max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="identity-heading" className="text-2xl font-semibold">Identity</h1>
        <Button type="submit" form="identity-form" disabled={!formState.isDirty || !formState.isValid} busy={save.isPending}>
          Save
        </Button>
      </div>
      {revision === 0 ? (
        <Notice tone="info">These are starting values from your account. Replace the bracketed placeholders, then save.</Notice>
      ) : null}
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <FormProvider {...form}>
        <FormSchemaProvider schema={identitySchema}>
          <form
            id="identity-form"
            data-dirty={formState.isDirty}
            data-valid={formState.isValid}
            onSubmit={(event) => void onSubmit(event)}
            noValidate
            className="flex flex-col gap-8"
          >
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="pb-2 text-lg font-semibold">About you</legend>
              <TextField name="fullName" label="Full name" />
              <TextField name="monogram" label="Initials shown as your logo" hint="1–3 capital letters or digits, e.g. GF" />
              <TextField name="roleTitle" label="Your job title" hint="e.g. Full Stack Developer" />
              <TextField name="email" label="Contact email" />
              <TextField name="location.label" label="Where you are based" hint="e.g. Kolkata, India" />
              <TextField name="location.timezoneLabel" label="Time zone (optional)" hint="e.g. IST (UTC+5:30)" />
            </fieldset>
            <fieldset className="flex flex-col gap-3">
              <legend className="pb-2 text-lg font-semibold">Availability</legend>
              <SwitchField name="availability.enabled" label={'Show the "open to work" badge on your page'} />
              <TextField name="availability.label" label="Badge text" hint="e.g. Open to Full Stack roles" />
            </fieldset>
            <ListField
              name="socials"
              label="Social media links"
              hint="Shown as icons in the hero and contact sections, e.g. your GitHub and LinkedIn profiles."
              itemLabel="link"
              newItem={() => ({ platform: 'website', url: 'https://' })}
              renderItem={(path) => (
                <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
                  <SelectField
                    name={`${path}.platform`}
                    label="Website"
                    options={SOCIAL_PLATFORMS.map((platform) => ({ value: platform, label: PLATFORM_LABELS[platform] }))}
                  />
                  <TextField name={`${path}.url`} label="Your profile address" hint="The full address of your profile, starting with https://" />
                </div>
              )}
            />
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="pb-2 text-lg font-semibold">Résumé</legend>
              <SelectField name="resume.assetId" label="Résumé file" options={assetOptions(resumes.data)} hint="Upload PDFs under Assets." />
              <TextField name="resume.label" label="Résumé button text" hint="e.g. Download CV" />
            </fieldset>
            <fieldset className="flex flex-col gap-4">
              <legend className="pb-2 text-lg font-semibold">Footer</legend>
              <TextField name="footer.copyrightName" label="Name in the copyright line" hint="Shown as © year name at the bottom of the page; the year is added automatically." />
              <TagListField name="footer.builtWith" label={'Tools listed in "Built with" at the bottom of the page'} hint="Type one and press Enter or Add, e.g. Next.js." />
            </fieldset>
            <fieldset className="flex flex-col gap-4">
              <legend className="pb-2 text-lg font-semibold">Search and sharing</legend>
              <TextField name="seo.title" label="Title in search results and browser tabs" hint="e.g. Jane Doe · Full Stack Developer" />
              <TextAreaField name="seo.description" label="Description in search results" hint="One or two sentences shown under the title on Google and when your link is shared." rows={3} />
              <SelectField name="seo.ogImageAssetId" label="Image shown when your link is shared" options={assetOptions(images.data)} hint="Upload images under Assets first." />
            </fieldset>
          </form>
        </FormSchemaProvider>
      </FormProvider>
      <ConflictDialog
        open={conflict !== null}
        busy={save.isPending}
        onCancel={() => {
          setConflict(null);
        }}
        onLoadLatest={() => void loadLatest()}
        onOverwrite={() => void overwrite()}
      />
    </section>
  );
}
