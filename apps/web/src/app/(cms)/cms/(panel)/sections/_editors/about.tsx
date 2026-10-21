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
      <EmphasisHeadingField name="heading" label="Section heading" hint="e.g. A bit about me." />
      <TextAreaField name="bio" label="About you" hint="A short paragraph about who you are and what you do. Leave a blank line to start a new paragraph." rows={6} />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">&quot;What I am doing now&quot; card</legend>
        <SwitchField name="currently.enabled" label="Show the doing-now card" />
        <TextField name="currently.label" label="Card title" hint="e.g. Currently" />
        <TextField name="currently.text" label="What you are working on now" hint="e.g. Building portfolio tooling" />
      </fieldset>
      <MetricListField name="stats" label="Key numbers" hint="Short figures shown as tiles, e.g. 2+ Years of experience." />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">&quot;How I work&quot; card</legend>
        <SwitchField name="process.enabled" label="Show the how-I-work card" />
        <TextField name="process.eyebrow" label="Small title above the card heading" hint="e.g. Process" />
        <TextField name="process.title" label="Card heading" hint="e.g. How I work" />
        <TextAreaField name="process.note" label="Note under the steps (optional)" rows={2} />
        <ListField
          name="process.steps"
          label="Steps of your process"
          hint="In order, e.g. 1 Spec, 2 Build, 3 Review."
          itemLabel="step"
          newItem={() => ({ title: '[Your step]', description: '[Your description of this step.]' })}
          renderItem={(path) => (
            <div className="flex flex-col gap-3">
              <TextField name={`${path}.title`} label="Step name" hint="e.g. Spec" />
              <TextAreaField name={`${path}.description`} label="What happens in this step" rows={2} />
            </div>
          )}
        />
      </fieldset>
    </>
  );
}

export const aboutEditor: SectionEditorEntry = { type: 'about', schema: aboutSectionSchema, Editor: AboutEditor };
