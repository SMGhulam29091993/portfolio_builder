'use client';
/**
 * The experience editor (`experience-timeline.T04`; AC8): month and year pickers, a "Current
 * role" switch that clears and disables the end date, and a highlights list. The preview shows
 * the derived ordering.
 */
import { experienceSectionSchema } from '@portfolio/contracts';
import { useFormContext, useWatch } from 'react-hook-form';

import type { SectionEditorEntry } from '../../../../../../components/cms/editor/editor-registry';
import { EmphasisHeadingField, ListField, MonthYearField, StringListField, TextField } from '../../../../../../components/cms/form';
import { focusRing } from '../../../../../../components/cms/ui';
import { MetaFields } from './meta-fields';

function CurrentRole({ path }: { path: string }) {
  const { setValue } = useFormContext();
  const end = useWatch({ name: `${path}.end` }) as { year: number; month: number } | null;
  const current = end === null;
  return (
    <>
      <label className="flex items-center gap-3 text-sm text-neutral-200">
        <input
          type="checkbox"
          role="switch"
          checked={current}
          onChange={(event) => {
            const now = new Date();
            setValue(`${path}.end`, event.target.checked ? null : { year: now.getFullYear(), month: now.getMonth() + 1 }, { shouldDirty: true, shouldValidate: true });
          }}
          className={`h-5 w-9 accent-lime-300 ${focusRing}`}
        />
        Current role
      </label>
      {current ? null : <MonthYearField name={`${path}.end`} label="End" />}
    </>
  );
}

function ExperienceEditor() {
  return (
    <>
      <MetaFields />
      <EmphasisHeadingField name="heading" label="Heading" />
      <TextField name="presentLabel" label="Word for a current role's end" />
      <ListField
        name="entries"
        label="Roles"
        itemLabel="role"
        newItem={() => ({ company: '[Your company]', role: '[Your role]', start: { year: new Date().getFullYear(), month: 1 }, end: null, highlights: ['[Your achievement.]'] })}
        renderItem={(path) => (
          <div className="flex flex-col gap-3">
            <TextField name={`${path}.company`} label="Company" />
            <TextField name={`${path}.role`} label="Role" />
            <TextField name={`${path}.location`} label="Location (optional)" />
            <MonthYearField name={`${path}.start`} label="Start" />
            <CurrentRole path={path} />
            <StringListField name={`${path}.highlights`} label="Highlights" itemLabel="highlight" multiline />
          </div>
        )}
      />
    </>
  );
}

export const experienceEditor: SectionEditorEntry = { type: 'experience', schema: experienceSectionSchema, Editor: ExperienceEditor };
