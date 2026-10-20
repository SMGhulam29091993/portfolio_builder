'use client';
/**
 * `ListField` — a list of items in a form (`cms-panel-shell.AC13`): add, remove after
 * confirmation, and reorder by dragging or with the keyboard (Move up / Move down buttons).
 * "Add" is disabled at the schema's maximum and "Remove" at its minimum. Item ids stay with
 * their items through every move, so the API keeps them stable (`section-engine.AC7`).
 */
import { useState, type ReactNode } from 'react';
import { useFieldArray, useFormContext, type FieldValues } from 'react-hook-form';

import { Button } from '../ui';
import { useFieldLimits } from './form-schema';

export interface ListFieldProps {
  /** The array's dot path in the form. */
  readonly name: string;
  readonly label: string;
  /** What one item is called in button labels ("project", "step"). */
  readonly itemLabel: string;
  /** A fresh item for "Add" — placeholder values the user then edits. */
  readonly newItem: () => FieldValues;
  /** The item's own fields; `path` is `<name>.<index>`. */
  readonly renderItem: (path: string, index: number) => ReactNode;
}

export function ListField({ name, label, itemLabel, newItem, renderItem }: ListFieldProps) {
  const { control } = useFormContext();
  const { fields, append, remove, move } = useFieldArray({ control, name });
  const { minItems = 0, maxItems = Number.POSITIVE_INFINITY } = useFieldLimits(name);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const atMax = fields.length >= maxItems;
  const atMin = fields.length <= minItems;

  return (
    <fieldset className="flex flex-col gap-3 rounded-2xl border border-neutral-800 p-4">
      <legend className="px-1 text-sm font-medium text-neutral-200">
        {label}{' '}
        <span className="text-xs text-neutral-500">
          ({fields.length}
          {Number.isFinite(maxItems) ? ` of at most ${String(maxItems)}` : ''})
        </span>
      </legend>
      <ol className="flex flex-col gap-3">
        {fields.map((field, index) => (
          <li
            key={field.id}
            draggable
            onDragStart={() => {
              setDragFrom(index);
            }}
            onDragOver={(event) => {
              event.preventDefault();
            }}
            onDrop={() => {
              if (dragFrom !== null && dragFrom !== index) move(dragFrom, index);
              setDragFrom(null);
            }}
            className="flex flex-col gap-3 rounded-xl border border-neutral-800 bg-neutral-950 p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs uppercase tracking-widest text-neutral-500">
                {itemLabel} {index + 1}
              </span>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  disabled={index === 0}
                  onClick={() => {
                    move(index, index - 1);
                  }}
                  aria-label={`Move ${itemLabel} ${String(index + 1)} up`}
                >
                  ↑
                </Button>
                <Button
                  variant="ghost"
                  disabled={index === fields.length - 1}
                  onClick={() => {
                    move(index, index + 1);
                  }}
                  aria-label={`Move ${itemLabel} ${String(index + 1)} down`}
                >
                  ↓
                </Button>
                <Button
                  variant="ghost"
                  disabled={atMin}
                  onClick={() => {
                    if (window.confirm(`Remove ${itemLabel} ${String(index + 1)}?`)) remove(index);
                  }}
                  aria-label={`Remove ${itemLabel} ${String(index + 1)}`}
                >
                  Remove
                </Button>
              </div>
            </div>
            {renderItem(`${name}.${String(index)}`, index)}
          </li>
        ))}
      </ol>
      <Button
        variant="secondary"
        disabled={atMax}
        onClick={() => {
          append(newItem());
        }}
      >
        Add {itemLabel}
      </Button>
    </fieldset>
  );
}
