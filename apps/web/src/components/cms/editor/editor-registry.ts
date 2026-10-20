/**
 * The editor registry's types and lookup (`cms-panel-shell.UT04`). An entry pairs a section
 * type with its contract schema — the same one the API validates with — and the component
 * that declares its fields.
 */
import type { ComponentType } from 'react';
import type { z } from 'zod';

/** What an editor receives: nothing but the section types, for link-target pickers. */
export interface SectionEditorProps {
  readonly sectionTypes: readonly { type: string; label: string }[];
}

export interface SectionEditorEntry {
  readonly type: string;
  readonly schema: z.ZodType;
  readonly Editor: ComponentType<SectionEditorProps>;
}

export interface EditorRegistry {
  get(type: string): SectionEditorEntry | undefined;
}

export function createEditorRegistry(entries: readonly SectionEditorEntry[]): EditorRegistry {
  const byType = new Map<string, SectionEditorEntry>();
  for (const entry of entries) {
    if (byType.has(entry.type)) throw new Error(`Editor for section "${entry.type}" is registered twice`);
    byType.set(entry.type, entry);
  }
  return { get: (type) => byType.get(type) };
}
