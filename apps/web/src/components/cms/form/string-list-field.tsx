'use client';
/**
 * A list of plain strings (`cms-panel-shell` form kit): marquee items, highlights, chip items.
 * Rows can be added, removed and moved up or down; Add and Remove follow the schema's limits
 * (`cms-panel-shell.AC13`). react-hook-form's field arrays need objects, so this binds the whole
 * array with one controller.
 */
import { useId } from 'react';
import { get, useController, useFormContext, type FieldError } from 'react-hook-form';

import { Button, focusRing } from '../ui';
import { useFieldLimits } from './form-schema';

export function StringListField({
  name,
  label,
  itemLabel,
  multiline = false,
  hint,
}: {
  name: string;
  label: string;
  itemLabel: string;
  multiline?: boolean;
  /** One plain sentence: what goes in each row and where it shows. */
  hint?: string;
}) {
  const id = useId();
  const { control, formState } = useFormContext();
  const { field } = useController({ name, control });
  const items = Array.isArray(field.value) ? (field.value as string[]) : [];
  const { minItems = 0, maxItems = Number.POSITIVE_INFINITY } = useFieldLimits(name);
  const { maxLength } = useFieldLimits(`${name}.0`);
  const errors = get(formState.errors, name) as (FieldError & Record<number, FieldError | undefined>) | undefined;

  const set = (next: string[]) => {
    field.onChange(next);
  };
  const move = (from: number, to: number) => {
    const next = [...items];
    const [moved] = next.splice(from, 1);
    if (moved !== undefined) next.splice(to, 0, moved);
    set(next);
  };

  return (
    <fieldset className="flex flex-col gap-2 rounded-2xl border border-neutral-800 p-4" aria-describedby={hint ? `${id}-hint` : undefined}>
      <legend className="px-1 text-sm font-medium text-neutral-200">
        {label} <span className="text-xs text-neutral-400">({items.length}{Number.isFinite(maxItems) ? ` of at most ${String(maxItems)}` : ''})</span>
      </legend>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-neutral-400">
          {hint}
        </p>
      ) : null}
      {errors?.message ? <p className="text-sm text-red-300">{errors.message}</p> : null}
      <ol className="flex flex-col gap-2">
        {items.map((item, index) => {
          const inputId = `${id}-${String(index)}`;
          const error = errors?.[index]?.message;
          const common = {
            id: inputId,
            value: item,
            maxLength,
            'aria-label': `${itemLabel} ${String(index + 1)}`,
            'aria-invalid': error ? true : undefined,
            onBlur: field.onBlur,
            className: `flex-1 rounded-lg border bg-neutral-900 px-3 py-2 text-neutral-100 ${error ? 'border-red-400' : 'border-neutral-700'} ${focusRing}`,
          };
          const change = (value: string) => {
            set(items.map((current, at) => (at === index ? value : current)));
          };
          return (
            <li key={index} className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                {multiline ? (
                  <textarea {...common} rows={2} onChange={(event) => { change(event.target.value); }} />
                ) : (
                  <input {...common} onChange={(event) => { change(event.target.value); }} />
                )}
                <Button variant="ghost" disabled={index === 0} aria-label={`Move ${itemLabel} ${String(index + 1)} up`} onClick={() => { move(index, index - 1); }}>↑</Button>
                <Button variant="ghost" disabled={index === items.length - 1} aria-label={`Move ${itemLabel} ${String(index + 1)} down`} onClick={() => { move(index, index + 1); }}>↓</Button>
                <Button variant="ghost" disabled={items.length <= minItems} aria-label={`Remove ${itemLabel} ${String(index + 1)}`} onClick={() => { set(items.filter((_, at) => at !== index)); }}>×</Button>
              </div>
              {error ? <p className="text-sm text-red-300">{error}</p> : null}
            </li>
          );
        })}
      </ol>
      <Button variant="secondary" disabled={items.length >= maxItems} onClick={() => { set([...items, '']); }}>
        Add {itemLabel}
      </Button>
    </fieldset>
  );
}
