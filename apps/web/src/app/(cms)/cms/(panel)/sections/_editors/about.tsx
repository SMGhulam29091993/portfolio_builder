'use client';
/** The about editor (`about-section.T04`; AC8). */
import { aboutSectionSchema } from '@portfolio/contracts';

import type { SectionEditorEntry } from '../../../../../../components/cms/editor/editor-registry';
import { EmphasisHeadingField, ListField, MetricListField, SwitchField, TextAreaField, TextField } from '../../../../../../components/cms/form';
import { MetaFields } from './meta-fields';

function AboutEditor() {
  return (
    <>
      <MetaFields />
      <EmphasisHeadingField name="heading" label="Heading" />
      <TextAreaField name="bio" label="Bio" rows={6} />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Currently</legend>
        <SwitchField name="currently.enabled" label="Show the Currently card" />
        <TextField name="currently.label" label="Label" />
        <TextField name="currently.text" label="Text" />
      </fieldset>
      <MetricListField name="stats" label="Stats" />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">How you work</legend>
        <SwitchField name="process.enabled" label="Show the process card" />
        <TextField name="process.eyebrow" label="Eyebrow" />
        <TextField name="process.title" label="Title" />
        <TextAreaField name="process.note" label="Side note (optional)" rows={2} />
        <ListField
          name="process.steps"
          label="Steps"
          itemLabel="step"
          newItem={() => ({ title: '[Step]', description: '[What happens in this step.]' })}
          renderItem={(path) => (
            <div className="flex flex-col gap-3">
              <TextField name={`${path}.title`} label="Title" />
              <TextAreaField name={`${path}.description`} label="Description" rows={2} />
            </div>
          )}
        />
      </fieldset>
    </>
  );
}

export const aboutEditor: SectionEditorEntry = { type: 'about', schema: aboutSectionSchema, Editor: AboutEditor };
