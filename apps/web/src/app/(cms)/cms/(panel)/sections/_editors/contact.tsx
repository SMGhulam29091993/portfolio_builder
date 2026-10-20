'use client';
/**
 * The contact editor (`contact-section.T04`; AC9): the identity's email shown read-only with a
 * link to Identity, where it is edited.
 */
import { contactSectionSchema } from '@portfolio/contracts';

import type { SectionEditorEntry } from '../../../../../../components/cms/editor/editor-registry';
import { EmphasisHeadingField, SwitchField, TextAreaField, TextField } from '../../../../../../components/cms/form';
import { TextLink } from '../../../../../../components/cms/ui';
import { useIdentity } from '../../../../../../lib/api/identity';
import { MetaFields } from './meta-fields';

function ContactEditor() {
  const identity = useIdentity();
  return (
    <>
      <MetaFields />
      <EmphasisHeadingField name="heading" label="Heading" />
      <TextAreaField name="body" label="Body (optional)" rows={3} />
      <div className="flex flex-col gap-1 rounded-xl border border-neutral-800 p-4 text-sm">
        <span className="text-neutral-400">Email address used by the button and the copy chip</span>
        <span className="font-mono text-neutral-100">{identity.data?.data.email ?? '…'}</span>
        <TextLink href="/cms/identity">Change it under Identity</TextLink>
      </div>
      <TextField name="emailCta.label" label="Email button text" />
      <TextField name="emailCta.subject" label="Email subject (optional)" />
      <SwitchField name="showCopyEmail" label="Show the copy-email chip" />
      <SwitchField name="showSocialLinks" label="Show social links (from Identity)" />
    </>
  );
}

export const contactEditor: SectionEditorEntry = { type: 'contact', schema: contactSectionSchema, Editor: ContactEditor };
