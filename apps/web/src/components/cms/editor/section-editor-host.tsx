'use client';
/**
 * `SectionEditorHost` — turns any registered section type into an editing screen
 * (`cms-panel-shell.T05`; AC4–AC8). Editors only declare fields; this host owns loading, the
 * form (react-hook-form with the section's contract schema — the API's own validation), the
 * Save rule (dirty and valid), saving with `expectedRevision`, mapping a 400 onto fields, the
 * 409 dialog, network errors with Retry, and registering unsaved changes for the guard.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import { FormProvider, useForm, type FieldValues } from 'react-hook-form';

import { ApiError } from '../../../lib/api/client';
import { portfolioKeys, usePortfolioDraft, useSaveSection, useSectionTypes } from '../../../lib/api/portfolio';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { useCmsUi } from '../../../lib/cms/ui-store';
import { FormSchemaProvider } from '../form';
import { Button, Notice } from '../ui';
import { ConflictDialog } from './conflict-dialog';
import type { EditorRegistry, SectionEditorEntry } from './editor-registry';
import { applyServerIssues, issuesOf } from './server-errors';

export interface SectionEditorHostProps {
  readonly type: string;
  readonly registry: EditorRegistry;
  /** Renders beside the form with the live values (`cms-panel-shell.T07` passes the preview). */
  readonly aside?: (values: { type: string; data: unknown }) => ReactNode;
}

export function SectionEditorHost({ type, registry, aside }: SectionEditorHostProps) {
  const draft = usePortfolioDraft();
  const types = useSectionTypes();
  const entry = registry.get(type);
  const section = draft.data?.sections.find((candidate) => candidate.type === type);
  const label = types.data?.find((info) => info.type === type)?.label ?? type;

  if (draft.isPending) return <p role="status">Loading the section…</p>;
  if (draft.isError) {
    return (
      <div className="flex max-w-md flex-col gap-3">
        <Notice tone="error">{genericErrorMessage(draft.error)}</Notice>
        <Button onClick={() => void draft.refetch()}>Retry</Button>
      </div>
    );
  }
  if (!section) return <Notice tone="info">This section does not exist.</Notice>;
  if (!entry) {
    return (
      <section aria-labelledby="editor-heading" className="flex flex-col gap-3">
        <h1 id="editor-heading" className="text-2xl font-semibold">{label}</h1>
        <Notice tone="info">No editor is available for this section.</Notice>
      </section>
    );
  }
  return (
    <EditorForm
      // A new revision from elsewhere remounts the form with fresh values only on "Load latest".
      key={type}
      entry={entry}
      label={label}
      revision={section.revision}
      data={section.data}
      sectionTypes={(types.data ?? []).map(({ type: value, label: name }) => ({ type: value, label: name }))}
      aside={aside}
    />
  );
}

function EditorForm({
  entry,
  label,
  revision,
  data,
  sectionTypes,
  aside,
}: {
  entry: SectionEditorEntry;
  label: string;
  revision: number;
  data: unknown;
  sectionTypes: readonly { type: string; label: string }[];
  aside?: SectionEditorHostProps['aside'];
}) {
  const { type, schema, Editor } = entry;
  const queryClient = useQueryClient();
  const save = useSaveSection();
  const notify = useCmsUi((state) => state.notify);
  const setDirty = useCmsUi((state) => state.setDirty);
  const [baseRevision, setBaseRevision] = useState(revision);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const form = useForm({
    // The registry holds schemas of many shapes as `z.ZodType`; the resolver's generics cannot
    // line that up with `FieldValues`, so the call is typed loosely here and the schema itself
    // still validates every value at runtime.
    resolver: zodResolver<FieldValues, unknown, FieldValues>(schema as never),
    defaultValues: data as FieldValues,
    mode: 'onChange',
  });
  const { formState, handleSubmit, reset, setError, setFocus, watch } = form;
  const dirtyKey = `section:${type}`;

  useEffect(() => {
    setDirty(dirtyKey, formState.isDirty);
    return () => {
      setDirty(dirtyKey, false);
    };
  }, [dirtyKey, formState.isDirty, setDirty]);

  const submit = async (values: FieldValues, expectedRevision: number) => {
    setFailure(null);
    try {
      const saved = await save.mutateAsync({ type, expectedRevision, data: values });
      setBaseRevision(saved.revision);
      setConflictRevision(null);
      // The stored data (with any server-assigned ids) becomes the new clean state.
      reset(saved.data as FieldValues);
      notify('success', `${label} saved.`);
    } catch (error) {
      if (!(error instanceof ApiError)) { setFailure(genericErrorMessage(error)); return; }
      if (error.code === 'REVISION_CONFLICT') {
        const current = error.data.currentRevision;
        setConflictRevision(typeof current === 'number' ? current : baseRevision); return;
      }
      if (error.code === 'VALIDATION_FAILED') {
        const first = applyServerIssues(issuesOf(error.data), (path, issue) => {
          setError(path, issue);
        });
        if (first) {
          setFocus(first);
          return undefined;
        }
      }
      setFailure(genericErrorMessage(error));
    }
    return undefined;
  };

  const onSubmit = handleSubmit((values) => submit(values, baseRevision));

  const loadLatest = async () => {
    await queryClient.invalidateQueries({ queryKey: portfolioKeys.draft });
    const latest = queryClient
      .getQueryData<{ sections: { type: string; revision: number; data: unknown }[] }>(portfolioKeys.draft)
      ?.sections.find((candidate) => candidate.type === type);
    if (latest) {
      setBaseRevision(latest.revision);
      reset(latest.data as FieldValues);
    }
    setConflictRevision(null);
  };

  const overwrite = handleSubmit((values) => submit(values, conflictRevision ?? baseRevision));

  return (
    <div className="flex flex-col gap-6 xl:flex-row">
      <section aria-labelledby="editor-heading" className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 id="editor-heading" className="text-2xl font-semibold">{label}</h1>
          <Button type="submit" form="section-editor" disabled={!formState.isDirty || !formState.isValid} busy={save.isPending}>
            Save
          </Button>
        </div>
        {failure ? (
          <Notice tone="error">
            <p>{failure}</p>
            <Button variant="secondary" className="mt-2" onClick={() => void onSubmit()}>
              Retry
            </Button>
          </Notice>
        ) : null}
        <FormProvider {...form}>
          <FormSchemaProvider schema={schema}>
            <form
              id="section-editor"
              data-dirty={formState.isDirty}
              data-valid={formState.isValid}
              onSubmit={(event) => void onSubmit(event)}
              noValidate
              className="flex flex-col gap-6"
            >
              <Editor sectionTypes={sectionTypes} />
            </form>
          </FormSchemaProvider>
        </FormProvider>
      </section>
      {aside ? <LiveAside type={type} watch={watch} render={aside} /> : null}
      <ConflictDialog
        open={conflictRevision !== null}
        busy={save.isPending}
        onCancel={() => {
          setConflictRevision(null);
        }}
        onLoadLatest={() => void loadLatest()}
        onOverwrite={() => void overwrite()}
      />
    </div>
  );
}

/** Re-renders the aside with the current form values as they change. */
function LiveAside({
  type,
  watch,
  render,
}: {
  type: string;
  watch: () => FieldValues;
  render: NonNullable<SectionEditorHostProps['aside']>;
}) {
  const values = watch();
  return <>{render({ type, data: values })}</>;
}
