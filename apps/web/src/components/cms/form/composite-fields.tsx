'use client';
/**
 * The form kit's composite fields (`cms-panel-shell.T04`) for the shared section primitives
 * (`section-engine` → Shared payload primitives): an emphasis heading, a metric list, a tag
 * list and a link target. Each composes the single fields, so labels, errors and counters
 * behave the same everywhere.
 */
import { useId, useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';

import { Button, focusRing } from '../ui';
import { TextField } from './fields';
import { useFieldLimits } from './form-schema';
import { ListField } from './list-field';

/** `EmphasisHeading`: the plain lead and the italic-serif emphasis. */
export function EmphasisHeadingField({ name, label }: { name: string; label: string }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="pb-1 text-sm font-medium text-neutral-200">{label}</legend>
      <TextField name={`${name}.lead`} label="Lead" />
      <TextField name={`${name}.emphasis`} label="Emphasis (italic accent)" hint="May be left empty." />
    </fieldset>
  );
}

/** A list of `Metric`s. */
export function MetricListField({ name, label }: { name: string; label: string }) {
  return (
    <ListField
      name={name}
      label={label}
      itemLabel="metric"
      newItem={() => ({ value: '[0]', label: '[What it measures]' })}
      renderItem={(path) => (
        <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
          <TextField name={`${path}.value`} label="Value" />
          <TextField name={`${path}.label`} label="Label" />
        </div>
      )}
    />
  );
}

/** A list of `Tag` strings: chips with a remove button, and an input that adds on Enter. */
export function TagListField({ name, label }: { name: string; label: string }) {
  const id = useId();
  const { control } = useFormContext();
  const { field } = useController({ name, control });
  const tags = Array.isArray(field.value) ? (field.value as string[]) : [];
  const { maxItems = Number.POSITIVE_INFINITY } = useFieldLimits(name);
  const { maxLength } = useFieldLimits(`${name}.0`);
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value || tags.length >= maxItems || tags.includes(value)) return;
    field.onChange([...tags, value]);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">
        {label}
      </label>
      <ul className="flex flex-wrap gap-2" aria-label={`${label} list`}>
        {tags.map((tag, index) => (
          <li key={`${tag}-${String(index)}`} className="flex items-center gap-1 rounded-full border border-neutral-700 px-3 py-1 text-sm">
            {tag}
            <button
              type="button"
              className={`rounded text-neutral-400 hover:text-white ${focusRing}`}
              onClick={() => {
                field.onChange(tags.filter((_, at) => at !== index));
              }}
            >
              <span aria-hidden="true">×</span>
              <span className="sr-only">Remove {tag}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          id={id}
          value={draft}
          maxLength={maxLength}
          disabled={tags.length >= maxItems}
          onChange={(event) => {
            setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add();
            }
          }}
          className={`flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 ${focusRing}`}
        />
        <Button variant="secondary" onClick={add} disabled={tags.length >= maxItems}>
          Add
        </Button>
      </div>
    </div>
  );
}

/** `LinkTarget`: another section of the page, or an external `https:`/`mailto:` link. */
export function LinkTargetField({
  name,
  label,
  sectionTypes,
}: {
  name: string;
  label: string;
  /** The page's section types, for the "Section" choice. */
  sectionTypes: readonly { type: string; label: string }[];
}) {
  const id = useId();
  const { register, setValue } = useFormContext();
  const kind: unknown = useWatch({ name: `${name}.kind` });
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="pb-1 text-sm font-medium text-neutral-200">{label}</legend>
      <div className="flex gap-4 text-sm">
        {(['section', 'url'] as const).map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input
              type="radio"
              value={option}
              className={focusRing}
              {...register(`${name}.kind`, {
                onChange: () => {
                  setValue(name, option === 'section' ? { kind: 'section', sectionType: sectionTypes[0]?.type ?? '' } : { kind: 'url', url: 'https://' }, { shouldDirty: true });
                },
              })}
            />
            {option === 'section' ? 'A section of this page' : 'An external link'}
          </label>
        ))}
      </div>
      {kind === 'section' ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={id} className="text-sm text-neutral-200">
            Section
          </label>
          <select id={id} className={`rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 ${focusRing}`} {...register(`${name}.sectionType`)}>
            {sectionTypes.map((option) => (
              <option key={option.type} value={option.type}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <TextField name={`${name}.url`} label="Link" hint="Starts with https: or mailto:" />
      )}
    </fieldset>
  );
}
