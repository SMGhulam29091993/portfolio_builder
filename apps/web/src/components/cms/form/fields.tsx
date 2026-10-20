'use client';
/**
 * The CMS form kit's single fields (`cms-panel-shell.T04`): text, textarea and switch, each
 * bound to the surrounding react-hook-form by `name`, labelled, with its error tied by
 * `aria-describedby` and a character counter from the schema's own limit
 * (`int-standards.nextjs.md` → Accessibility, Forms).
 */
import { useId } from 'react';
import { get, useFormContext, useWatch, type FieldError } from 'react-hook-form';

import { focusRing } from '../ui';
import { useFieldLimits } from './form-schema';

interface FieldProps {
  /** The dot path in the form, e.g. `heading.lead` or `items.2.title`. */
  readonly name: string;
  readonly label: string;
  readonly hint?: string;
}

function useFieldError(name: string): string | undefined {
  const { formState } = useFormContext();
  const error = get(formState.errors, name) as FieldError | undefined;
  return error?.message;
}

function Counter({ name, max, id }: { name: string; max: number; id: string }) {
  const value: unknown = useWatch({ name });
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <span id={id} className={`text-xs ${length > max ? 'text-red-300' : 'text-neutral-400'}`}>
      {length}/{max}
    </span>
  );
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  counter,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  counter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-neutral-200">
          {label}
        </label>
        {counter}
      </div>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-neutral-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string, counter?: boolean): string | undefined {
  return [hint ? `${id}-hint` : '', error ? `${id}-error` : '', counter ? `${id}-count` : ''].filter(Boolean).join(' ') || undefined;
}

const INPUT = 'rounded-lg border bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-500';

/** A single-line text field with a character counter. */
export function TextField({ name, label, hint }: FieldProps) {
  const id = useId();
  const { register } = useFormContext();
  const error = useFieldError(name);
  const { maxLength } = useFieldLimits(name);
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      counter={maxLength === undefined ? undefined : <Counter name={name} max={maxLength} id={`${id}-count`} />}
    >
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error, maxLength !== undefined)}
        className={`${INPUT} ${error ? 'border-red-400' : 'border-neutral-700'} ${focusRing}`}
        {...register(name)}
      />
    </FieldFrame>
  );
}

/** A multi-line text field with a character counter. */
export function TextAreaField({ name, label, hint, rows = 4 }: FieldProps & { rows?: number }) {
  const id = useId();
  const { register } = useFormContext();
  const error = useFieldError(name);
  const { maxLength } = useFieldLimits(name);
  return (
    <FieldFrame
      id={id}
      label={label}
      hint={hint}
      error={error}
      counter={maxLength === undefined ? undefined : <Counter name={name} max={maxLength} id={`${id}-count`} />}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, hint, error, maxLength !== undefined)}
        className={`${INPUT} ${error ? 'border-red-400' : 'border-neutral-700'} ${focusRing}`}
        {...register(name)}
      />
    </FieldFrame>
  );
}

/** An on/off switch: a checkbox with `role="switch"`. */
export function SwitchField({ name, label, hint }: FieldProps) {
  const id = useId();
  const { register } = useFormContext();
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="checkbox"
        role="switch"
        aria-describedby={hint ? `${id}-hint` : undefined}
        className={`h-5 w-9 cursor-pointer accent-lime-300 ${focusRing}`}
        {...register(name)}
      />
      <label htmlFor={id} className="text-sm text-neutral-200">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-neutral-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
