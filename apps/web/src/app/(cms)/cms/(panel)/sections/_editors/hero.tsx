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
    setValue(`${path}.value`, isList ? next : next.length > 0 ? next : ['[Your item]'], { shouldDirty: true, shouldValidate: true });
  };
  return (
    <div className="flex flex-col gap-2">
      {isList ? (
        <StringListField name={`${path}.value`} label="Line values" itemLabel="value" hint="Each value is shown in quotes inside [ ], e.g. TypeScript, Node.js." />
      ) : (
        <TextField name={`${path}.value`} label="Line value" hint="Shown in quotes after the line name, e.g. Full Stack Developer." />
      )}
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
      <EmphasisHeadingField name="heading" label="Main headline" hint="The large text at the top of your page, e.g. I build products that ship in days." />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Introduction under the headline</legend>
        <TextField name="intro.prefix" label="Greeting before your name (optional)" hint="e.g. Hi, I am" />
        <SwitchField name="intro.showName" label="Show your name after the greeting (set under Identity)" />
        <TextAreaField name="intro.body" label="Introduction text" hint="One or two sentences about what you do." rows={3} />
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Buttons under the introduction</legend>
        <div className="flex flex-col gap-3">
          <TextField name="primaryCta.label" label="Main button text" hint="e.g. See my work" />
          <LinkTargetField name="primaryCta.target" label="Main button opens" sectionTypes={targets} />
        </div>
        {hasSecondary ? (
          <div className="flex flex-col gap-3">
            <TextField name="secondaryCta.label" label="Second button text" hint="e.g. Get in touch" />
            <LinkTargetField name="secondaryCta.target" label="Second button opens" sectionTypes={targets} />
            <Button variant="ghost" className="self-start" onClick={() => { setValue('secondaryCta', null, { shouldDirty: true, shouldValidate: true }); }}>Remove the second button</Button>
          </div>
        ) : (
          <Button variant="secondary" className="self-start" onClick={() => { setValue('secondaryCta', { label: 'Get in touch', target: { kind: 'section', sectionType: targets.at(-1)?.type ?? 'contact' } }, { shouldDirty: true, shouldValidate: true }); }}>
            Add a second button
          </Button>
        )}
      </fieldset>
      <SwitchField name="showAvailability" label={'Show the "open to work" badge (text set under Identity)'} />
      <SwitchField name="showSocialIcons" label="Show social media icons (links set under Identity)" />
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Code-style profile card</legend>
        <SwitchField name="codeCard.enabled" label="Show the code-style card beside the headline" />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="codeCard.filename" label="Card title (looks like a file name)" hint="e.g. me.config.ts" />
          <TextField name="codeCard.exportName" label={'Name after "export const"'} hint="One word, letters and digits only, e.g. me" />
        </div>
        <SwitchField name="codeCard.showLocation" label="Show your location under the card (set under Identity)" />
        <ListField
          name="codeCard.entries"
          label="Card lines"
          hint="Each line reads name: value, like a line of code, e.g. role: Full Stack Developer."
          itemLabel="line"
          newItem={() => ({ key: 'key', value: '[Your value]' })}
          renderItem={(path) => (
            <div className="flex flex-col gap-3">
              <TextField name={`${path}.key`} label="Line name" hint="One word, letters and digits only, e.g. role" />
              <ValueEditor path={path} />
            </div>
          )}
        />
      </fieldset>
      <fieldset className="flex flex-col gap-3">
        <legend className="pb-1 text-sm font-medium text-neutral-200">Scrolling skills strip</legend>
        <SwitchField name="marquee.enabled" label="Show the strip that scrolls across the bottom of the hero" />
        <StringListField name="marquee.items" label="Skills or tools in the strip" itemLabel="skill" hint="One per row, e.g. TypeScript." />
      </fieldset>
    </>
  );
}

export const heroEditor: SectionEditorEntry = { type: 'hero', schema: heroSectionSchema, Editor: HeroEditor };
