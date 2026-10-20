'use client';
/**
 * A labelled select bound to the form (`cms-panel-shell` form kit). `null` options are stored as
 * `null` (an asset select's "None"), everything else as the option's string value.
 */
import { useId } from 'react';
import { get, useController, useFormContext, type FieldError } from 'react-hook-form';

import { focusRing } from '../ui';

export interface SelectOption {
  readonly value: string | null;
  readonly label: string;
}

const NONE = '';

export function SelectField({ name, label, options, hint }: { name: string; label: string; options: readonly SelectOption[]; hint?: string }) {
  const id = useId();
  const { control, formState } = useFormContext();
  const { field } = useController({ name, control });
  const error = (get(formState.errors, name) as FieldError | undefined)?.message;
  const value = typeof field.value === 'string' ? field.value : NONE;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">{label}</label>
      <select
        id={id}
        value={value}
        onBlur={field.onBlur}
        onChange={(event) => {
          field.onChange(event.target.value === NONE ? null : event.target.value);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        className={`rounded-lg border bg-neutral-900 px-3 py-2 text-neutral-100 ${error ? 'border-red-400' : 'border-neutral-700'} ${focusRing}`}
      >
        {options.map((option) => (
          <option key={option.value ?? NONE} value={option.value ?? NONE}>{option.label}</option>
        ))}
      </select>
      {hint ? <p id={`${id}-hint`} className="text-xs text-neutral-400">{hint}</p> : null}
      {error ? <p id={`${id}-error`} className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}
