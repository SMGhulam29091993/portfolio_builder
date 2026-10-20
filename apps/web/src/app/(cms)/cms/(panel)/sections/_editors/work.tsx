'use client';
/**
 * The work editor (`work-showcase.T04`; AC10): a reorderable project list; marking one project
 * featured clears the flag on every other; the metric list's limit follows the featured state.
 */
import { workSectionSchema } from '@portfolio/contracts';
import { useFormContext, useWatch } from 'react-hook-form';

import type { SectionEditorEntry } from '../../../../../../components/cms/editor/editor-registry';
import { EmphasisHeadingField, ListField, TagListField, TextAreaField, TextField } from '../../../../../../components/cms/form';
import { focusRing } from '../../../../../../components/cms/ui';
import { MetaFields } from './meta-fields';

/** The featured switch: turning one on turns every other off. */
function FeaturedSwitch({ index }: { index: number }) {
  const { setValue } = useFormContext();
  const projects = (useWatch({ name: 'projects' }) ?? []) as { featured: boolean }[];
  const featured = projects[index]?.featured ?? false;
  return (
    <label className="flex items-center gap-3 text-sm text-neutral-200">
      <input
        type="checkbox"
        role="switch"
        checked={featured}
        onChange={(event) => {
          projects.forEach((_, at) => {
            setValue(`projects.${String(at)}.featured`, at === index ? event.target.checked : false, { shouldDirty: true, shouldValidate: true });
          });
        }}
        className={`h-5 w-9 accent-lime-300 ${focusRing}`}
      />
      Featured (shown full width, up to four metrics)
    </label>
  );
}

function MetricsHint({ index }: { index: number }) {
  const featured = useWatch({ name: `projects.${String(index)}.featured` }) as boolean;
  return <p className="text-xs text-neutral-400">{featured ? 'Up to four metrics.' : 'Up to two metrics unless featured.'}</p>;
}

function WorkEditor() {
  return (
    <>
      <MetaFields />
      <EmphasisHeadingField name="heading" label="Heading" />
      <TextField name="featuredBadge" label="Featured badge text" />
      <ListField
        name="projects"
        label="Projects"
        itemLabel="project"
        newItem={() => ({ title: '[Project]', category: '[Category]', description: '[What it does.]', featured: false, metrics: [], tags: [], link: null })}
        renderItem={(path, index) => (
          <div className="flex flex-col gap-3">
            <FeaturedSwitch index={index} />
            <TextField name={`${path}.title`} label="Title" />
            <TextField name={`${path}.category`} label="Category" />
            <TextAreaField name={`${path}.description`} label="Description" rows={4} />
            <MetricsHint index={index} />
            <ListField
              name={`${path}.metrics`}
              label="Metrics"
              itemLabel="metric"
              newItem={() => ({ value: '[0]', label: '[What it measures]' })}
              renderItem={(metricPath) => (
                <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
                  <TextField name={`${metricPath}.value`} label="Value" />
                  <TextField name={`${metricPath}.label`} label="Label" />
                </div>
              )}
            />
            <TagListField name={`${path}.tags`} label="Tags" />
            <LinkField path={path} />
          </div>
        )}
      />
    </>
  );
}

/** The project link: `null` when empty, an `https:` URL otherwise. */
function LinkField({ path }: { path: string }) {
  const { register } = useFormContext();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${path}-link`} className="text-sm font-medium text-neutral-200">Link (optional)</label>
      <input
        id={`${path}-link`}
        placeholder="https://"
        className={`rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 ${focusRing}`}
        {...register(`${path}.link`, { setValueAs: (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null) })}
      />
    </div>
  );
}

export const workEditor: SectionEditorEntry = { type: 'work', schema: workSectionSchema, Editor: WorkEditor };
