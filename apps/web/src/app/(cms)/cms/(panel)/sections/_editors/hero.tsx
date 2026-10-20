'use client';
/**
 * The hero editor (`hero-section.T05`; AC12): every field of the payload, each code-card value
 * switchable between text and a list, list limits from the schema. Name, availability, socials
 * and location are edited under Identity.
 */
import { heroSectionSchema } from '@portfolio/contracts';
import { useFormContext, useWatch } from 'react-hook-form';

import type { SectionEditorEntry, SectionEditorProps } from '../../../../../../components/cms/editor/editor-registry';
import { EmphasisHeadingField, LinkTargetField, ListField, StringListField, SwitchField, TextAreaField, TextField } from '../../../../../../components/cms/form';
import { Button } from '../../../../../../components/cms/ui';

/** Switches one code-card value between a quoted string and a list of strings. */
function ValueEditor({ path }: { path: string }) {
  const { setValue } = useFormContext();
  const value: unknown = useWatch({ name: `${path}.value` });
  const isList = Array.isArray(value);
  const toggle = () => {
    const next = isList ? (value as string[]).join(', ') : (typeof value === 'string' ? value : '').split(',').map((part) => part.trim()).filter(Boolean).slice(0, 8);
    setValue(`${path}.value`, isList ? next : next.length > 0 ? next : ['[Item]'], { shouldDirty: true, shouldValidate: true });
  };
  return (
    <div className="flex flex-col gap-2">
      {isList ? <StringListField name={`${path}.value`} label="Values" itemLabel="value" /> : <TextField name={`${path}.value`} label="Value" />}
      <Button variant="ghost" className="self-start" onClick={toggle}>
        {isList ? 'Use a single text value' : 'Use a list of values'}
      </Button>
    </div>
  );
}

function HeroEditor({ sectionTypes }: SectionEditorProps) {
  const targets = sectionTypes.filter((entry) => entry.type !== 'hero');
  const hasSecondary = useWatch({ name: 'secondaryCta' }) !== null;
  const { setValue } = useFormContext();
  return (
    <>
      <EmphasisHeadingField name="heading" label="Headline" />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Introduction</legend>
        <TextField name="intro.prefix" label="Before your name" />
        <SwitchField name="intro.showName" label="Show your name (from Identity)" />
        <TextAreaField name="intro.body" label="Introduction" rows={3} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Buttons</legend>
        <div className="flex flex-col gap-3">
          <TextField name="primaryCta.label" label="Primary button" />
          <LinkTargetField name="primaryCta.target" label="Primary goes to" sectionTypes={targets} />
        </div>
        {hasSecondary ? (
          <div className="flex flex-col gap-3">
            <TextField name="secondaryCta.label" label="Secondary button" />
            <LinkTargetField name="secondaryCta.target" label="Secondary goes to" sectionTypes={targets} />
            <Button variant="ghost" className="self-start" onClick={() => { setValue('secondaryCta', null, { shouldDirty: true, shouldValidate: true }); }}>Remove the secondary button</Button>
          </div>
        ) : (
          <Button variant="secondary" className="self-start" onClick={() => { setValue('secondaryCta', { label: 'Get in touch', target: { kind: 'section', sectionType: targets.at(-1)?.type ?? 'contact' } }, { shouldDirty: true, shouldValidate: true }); }}>
            Add a secondary button
          </Button>
        )}
      </fieldset>
      <SwitchField name="showAvailability" label="Show the availability badge (from Identity)" />
      <SwitchField name="showSocialIcons" label="Show social icons (from Identity)" />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Code card</legend>
        <SwitchField name="codeCard.enabled" label="Show the code card" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="codeCard.filename" label="File name" />
          <TextField name="codeCard.exportName" label="Export name" />
        </div>
        <SwitchField name="codeCard.showLocation" label="Show your location (from Identity)" />
        <ListField
          name="codeCard.entries"
          label="Lines"
          itemLabel="line"
          newItem={() => ({ key: 'key', value: '[Value]' })}
          renderItem={(path) => (
            <div className="flex flex-col gap-3">
              <TextField name={`${path}.key`} label="Key" />
              <ValueEditor path={path} />
            </div>
          )}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Tech strip</legend>
        <SwitchField name="marquee.enabled" label="Show the scrolling strip" />
        <StringListField name="marquee.items" label="Items" itemLabel="item" />
      </fieldset>
    </>
  );
}

export const heroEditor: SectionEditorEntry = { type: 'hero', schema: heroSectionSchema, Editor: HeroEditor };
