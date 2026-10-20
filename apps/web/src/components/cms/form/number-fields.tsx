'use client';
/**
 * Number inputs for the form kit: a year field and a month-and-year pair
 * (`experience-timeline.T04` → `MonthYearField`). Values are stored as numbers.
 */
import { useId } from 'react';
import { get, useFormContext, type FieldError } from 'react-hook-form';

import { focusRing } from '../ui';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const INPUT = `rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-100 ${focusRing}`;

function useError(name: string): string | undefined {
  const { formState } = useFormContext();
  return (get(formState.errors, name) as FieldError | undefined)?.message;
}

export function YearField({ name, label, disabled = false }: { name: string; label: string; disabled?: boolean }) {
  const id = useId();
  const { register } = useFormContext();
  const error = useError(name);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-neutral-200">{label}</label>
      <input id={id} type="number" inputMode="numeric" disabled={disabled} aria-invalid={error ? true : undefined} className={INPUT} {...register(name, { valueAsNumber: true })} />
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </div>
  );
}

export function MonthYearField({ name, label, disabled = false }: { name: string; label: string; disabled?: boolean }) {
  const id = useId();
  const { register } = useFormContext();
  // Every hook runs on every render; only the first message is shown.
  const ownError = useError(name);
  const monthError = useError(`${name}.month`);
  const yearError = useError(`${name}.year`);
  const error = ownError ?? monthError ?? yearError;
  return (
    <fieldset className="flex flex-col gap-1.5" disabled={disabled}>
      <legend className="pb-1 text-sm font-medium text-neutral-200">{label}</legend>
      <div className="flex gap-2">
        <label htmlFor={`${id}-month`} className="sr-only">{label} month</label>
        <select id={`${id}-month`} className={INPUT} {...register(`${name}.month`, { setValueAs: (value: string) => Number(value) })}>
          {MONTHS.map((month, index) => (
            <option key={month} value={index + 1}>{month}</option>
          ))}
        </select>
        <label htmlFor={`${id}-year`} className="sr-only">{label} year</label>
        <input id={`${id}-year`} type="number" inputMode="numeric" className={`w-28 ${INPUT}`} {...register(`${name}.year`, { valueAsNumber: true })} />
      </div>
      {error ? <p className="text-sm text-red-300">{error}</p> : null}
    </fieldset>
  );
}
