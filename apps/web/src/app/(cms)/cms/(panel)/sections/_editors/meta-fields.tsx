'use client';
/** The `SectionMeta` fields every orderable section shares (eyebrow, nav label, in-nav switch). */
import { SwitchField, TextField } from '../../../../../../components/cms/form';

export function MetaFields() {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="pb-1 text-sm font-medium text-neutral-200">Section name and menu</legend>
      <TextField name="meta.eyebrow" label="Small title above the heading" hint="A word or two shown after the section number, e.g. About me." />
      <TextField name="meta.navLabel" label="Name in the top menu" hint="The link visitors click to jump here, e.g. About." />
      <SwitchField name="meta.showInNav" label="Show this section in the top menu" />
    </fieldset>
  );
}
