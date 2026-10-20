'use client';
/** The `SectionMeta` fields every orderable section shares (eyebrow, nav label, in-nav switch). */
import { SwitchField, TextField } from '../../../../../../components/cms/form';

export function MetaFields() {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="pb-1 text-sm font-medium text-neutral-200">Section label</legend>
      <TextField name="meta.eyebrow" label="Eyebrow" hint="Shown after the section number." />
      <TextField name="meta.navLabel" label="Navigation label" />
      <SwitchField name="meta.showInNav" label="Show in the navigation" />
    </fieldset>
  );
}
