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
        I still work here
      </label>
      {current ? null : <MonthYearField name={`${path}.end`} label="End date" />}
    </>
  );
}

function ExperienceEditor() {
  return (
    <>
      <MetaFields />
      <EmphasisHeadingField name="heading" label="Section heading" hint="e.g. Where I have worked." />
      <TextField name="presentLabel" label="Text shown instead of an end date for a current job" hint="e.g. Present" />
      <ListField
        name="entries"
        label="Jobs"
        hint="Newest first. Drag or use the arrows to reorder."
        itemLabel="job"
        newItem={() => ({ company: '[Your company]', role: '[Your role]', start: { year: new Date().getFullYear(), month: 1 }, end: null, highlights: ['[Your achievement.]'] })}
        renderItem={(path) => (
          <div className="flex flex-col gap-3">
            <TextField name={`${path}.company`} label="Company name" />
            <TextField name={`${path}.role`} label="Job title" hint="e.g. Full Stack Developer" />
            <TextField name={`${path}.location`} label="City or Remote (optional)" />
            <MonthYearField name={`${path}.start`} label="Start date" />
            <CurrentRole path={path} />
            <StringListField
              name={`${path}.highlights`}
              label="What you achieved"
              itemLabel="achievement"
              hint="One achievement per row, e.g. Cut page load time by 40%."
              multiline
            />
          </div>
        )}
      />
    </>
  );
}

export const experienceEditor: SectionEditorEntry = { type: 'experience', schema: experienceSectionSchema, Editor: ExperienceEditor };
