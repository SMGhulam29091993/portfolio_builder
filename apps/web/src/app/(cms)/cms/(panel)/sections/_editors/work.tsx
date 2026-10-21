'use client';
/**
 * The work editor (`work-showcase.T04`; AC10): a reorderable project list; marking one project
 * featured clears the flag on every other; the metric list's limit follows the featured state.
 */
import { workSectionSchema } from '@portfolio/contracts';
import { useFormContext, useWatch } from 'react-hook-form';

import type { SectionEditorEntry } from '../../../../../../components/cms/editor/editor-registry';
import { EmphasisHeadingField, ListField, MetricFields, TagListField, TextAreaField, TextField } from '../../../../../../components/cms/form';
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
      Feature this project (shown large at the top, with up to four numbers)
    </label>
  );
}

function MetricsHint({ index }: { index: number }) {
  const featured = useWatch({ name: `projects.${String(index)}.featured` }) as boolean;
  return <p className="text-xs text-neutral-400">{featured ? 'Up to four numbers.' : 'Up to two numbers; feature the project to show four.'}</p>;
}

function WorkEditor() {
  return (
    <>
      <MetaFields />
      <EmphasisHeadingField name="heading" label="Section heading" hint="e.g. Selected work." />
      <TextField name="featuredBadge" label="Badge on the featured project" hint="e.g. Featured" />
      <ListField
        name="projects"
        label="Projects"
        hint="Shown in this order. Drag or use the arrows to reorder."
        itemLabel="project"
        newItem={() => ({ title: '[Your project]', category: '[Your category]', description: '[Your description.]', featured: false, metrics: [], tags: [], link: null })}
        renderItem={(path, index) => (
          <div className="flex flex-col gap-3">
            <FeaturedSwitch index={index} />
            <TextField name={`${path}.title`} label="Project name" />
            <TextField name={`${path}.category`} label="Project type" hint="e.g. SaaS · AI, or Open source" />
            <TextAreaField name={`${path}.description`} label="What the project is and what you did" rows={4} />
            <MetricsHint index={index} />
            <ListField
              name={`${path}.metrics`}
              label="Results in numbers (optional)"
              itemLabel="number"
              newItem={() => ({ value: '[Your stat]', label: '[Your metric label]' })}
              renderItem={(metricPath) => <MetricFields path={metricPath} />}
            />
            <TagListField name={`${path}.tags`} label="Technologies used" hint="Type one and press Enter or Add, e.g. Next.js." />
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
      <label htmlFor={`${path}-link`} className="text-sm font-medium text-neutral-200">Project link (optional)</label>
      <input
        id={`${path}-link`}
        placeholder="https://"
        aria-describedby={`${path}-link-hint`}
        className={`rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 ${focusRing}`}
        {...register(`${path}.link`, { setValueAs: (value: unknown) => (typeof value === 'string' && value.trim() !== '' ? value.trim() : null) })}
      />
      <p id={`${path}-link-hint`} className="text-xs text-neutral-400">The live site or repository, starting with https://. Leave empty for none.</p>
    </div>
  );
}

export const workEditor: SectionEditorEntry = { type: 'work', schema: workSectionSchema, Editor: WorkEditor };
