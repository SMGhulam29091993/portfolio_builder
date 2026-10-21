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
      <label htmlFor={`${path}-url`} className="text-sm font-medium text-neutral-200">Certificate link (optional)</label>
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
      <label htmlFor={`${path}-end`} className="text-sm font-medium text-neutral-200">End year (leave empty if still studying)</label>
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
      <EmphasisHeadingField name="heading" label="Section heading" hint="e.g. Tools I use." />
      <ListField
        name="groups"
        label="Skill groups"
        hint="Each group is a titled row of skills, e.g. Frontend: React, Next.js."
        itemLabel="group"
        newItem={() => ({ label: '[Your group]', items: ['[Your tool]'] })}
        renderItem={(path) => (
          <div className="flex flex-col gap-3">
            <TextField name={`${path}.label`} label="Group name" hint="e.g. Frontend" />
            <StringListField name={`${path}.items`} label="Skills in this group" itemLabel="skill" hint="One per row, e.g. React." />
          </div>
        )}
      />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Education</legend>
        <SwitchField name="education.enabled" label="Show your education" />
        <TextField name="education.label" label="Education card title" hint="e.g. Education" />
        <ListField
          name="education.entries"
          label="Degrees and courses"
          itemLabel="degree"
          newItem={() => ({ title: '[Your degree]', institution: '[Your institution]', startYear: new Date().getFullYear() - 1, endYear: null })}
          renderItem={(path) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name={`${path}.title`} label="Degree or course" hint="e.g. B.Tech in Computer Science" />
              <TextField name={`${path}.institution`} label="School or university" />
              <YearField name={`${path}.startYear`} label="Start year" />
              <OptionalEndYear path={path} />
              <TextField name={`${path}.detail`} label="Grade or note (optional)" hint="e.g. First class" />
            </div>
          )}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Certifications</legend>
        <SwitchField name="certifications.enabled" label="Show your certifications" />
        <TextField name="certifications.label" label="Certifications card title" hint="e.g. Certifications" />
        <ListField
          name="certifications.entries"
          label="Certifications"
          itemLabel="certification"
          newItem={() => ({ name: '[Your certification]', issuer: '[Your issuer]', url: null })}
          renderItem={(path) => (
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField name={`${path}.name`} label="Certificate name" hint="e.g. AWS Cloud Practitioner" />
              <TextField name={`${path}.issuer`} label="Issued by" hint="e.g. Amazon Web Services" />
              <OptionalUrl path={path} />
            </div>
          )}
        />
      </fieldset>
    </>
  );
}

export const stackEditor: SectionEditorEntry = { type: 'stack', schema: stackSectionSchema, Editor: StackEditor };
