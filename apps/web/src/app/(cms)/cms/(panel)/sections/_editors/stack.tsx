'use client';
/** The stack editor (`stack-credentials.T04`; AC9). */
import { stackSectionSchema } from '@portfolio/contracts';
import { useFormContext } from 'react-hook-form';

import type { SectionEditorEntry } from '../../../../../../components/cms/editor/editor-registry';
import { EmphasisHeadingField, ListField, StringListField, SwitchField, TextField, YearField } from '../../../../../../components/cms/form';
import { focusRing } from '../../../../../../components/cms/ui';
import { MetaFields } from './meta-fields';

function OptionalUrl({ path }: { path: string }) {
  const { register } = useFormContext();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${path}-url`} className="text-sm font-medium text-neutral-200">Link (optional)</label>
      <input
        id={`${path}-url`}
        placeholder="https://"
        className={`rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 ${focusRing}`}
        {...register(`${path}.url`, { setValueAs: (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null) })}
      />
    </div>
  );
}

function OptionalEndYear({ path }: { path: string }) {
  const { register } = useFormContext();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${path}-end`} className="text-sm font-medium text-neutral-200">End year (empty if ongoing)</label>
      <input
        id={`${path}-end`}
        type="number"
        className={`rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 ${focusRing}`}
        {...register(`${path}.endYear`, { setValueAs: (value: unknown) => (value === '' || value === null ? null : Number(value)) })}
      />
    </div>
  );
}

function StackEditor() {
  return (
    <>
      <MetaFields />
      <EmphasisHeadingField name="heading" label="Heading" />
      <ListField
        name="groups"
        label="Groups"
        itemLabel="group"
        newItem={() => ({ label: '[Group]', items: ['[Tool]'] })}
        renderItem={(path) => (
          <div className="flex flex-col gap-3">
            <TextField name={`${path}.label`} label="Label" />
            <StringListField name={`${path}.items`} label="Items" itemLabel="item" />
          </div>
        )}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Education</legend>
        <SwitchField name="education.enabled" label="Show education" />
        <TextField name="education.label" label="Card title" />
        <ListField
          name="education.entries"
          label="Entries"
          itemLabel="entry"
          newItem={() => ({ title: '[Degree]', institution: '[Institution]', startYear: new Date().getFullYear() - 1, endYear: null })}
          renderItem={(path) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name={`${path}.title`} label="Title" />
              <TextField name={`${path}.institution`} label="Institution" />
              <YearField name={`${path}.startYear`} label="Start year" />
              <OptionalEndYear path={path} />
              <TextField name={`${path}.detail`} label="Detail (optional)" />
            </div>
          )}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Certifications</legend>
        <SwitchField name="certifications.enabled" label="Show certifications" />
        <TextField name="certifications.label" label="Card title" />
        <ListField
          name="certifications.entries"
          label="Certifications"
          itemLabel="certification"
          newItem={() => ({ name: '[Certification]', issuer: '[Issuer]', url: null })}
          renderItem={(path) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name={`${path}.name`} label="Name" />
              <TextField name={`${path}.issuer`} label="Issuer" />
              <OptionalUrl path={path} />
            </div>
          )}
        />
      </fieldset>
    </>
  );
}

export const stackEditor: SectionEditorEntry = { type: 'stack', schema: stackSectionSchema, Editor: StackEditor };
