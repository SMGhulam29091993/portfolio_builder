/**
 * The `hero` payload (`hero-section` spec → API Contract): headline, intro, calls to action,
 * the `ghulam.config.ts`-style code card and the tech marquee. Name, availability, socials and
 * location come from the identity, not from here.
 */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import { emphasisHeadingSchema, identifierSchema, linkTargetSchema, listItem, reportDuplicates, tagSchema } from './primitives.js';

// Each rule sits on the narrowest schema that owns it, so every problem is reported at once.
const ctaSchema = z.object({ label: plainText(24), target: linkTargetSchema }).superRefine((cta, context) => {
  if (cta.target.kind === 'section' && cta.target.sectionType === 'hero') {
    context.addIssue({ code: 'custom', path: ['target', 'sectionType'], message: 'A button cannot point at the hero itself' });
  }
});

const codeCardEntrySchema = listItem({
  key: identifierSchema(20),
  /** A quoted string, or a bracketed list of quoted strings. */
  value: z.union([plainText(80), z.array(plainText(24)).min(1).max(8)]),
});

export const heroSectionSchema = z.object({
    heading: emphasisHeadingSchema,
    intro: z.object({ prefix: plainText(40, { min: 0 }).optional(), showName: z.boolean(), body: plainText(280) }),
    primaryCta: ctaSchema,
    secondaryCta: ctaSchema.nullable(),
    showAvailability: z.boolean(),
    showSocialIcons: z.boolean(),
    codeCard: z.object({
      enabled: z.boolean(),
      filename: plainText(40),
      exportName: identifierSchema(24),
      showLocation: z.boolean(),
      entries: z
        .array(codeCardEntrySchema)
        .min(1)
        .max(8)
        .superRefine((entries, context) => {
          reportDuplicates(entries.map((entry) => entry.key), context, (index) => [index, 'key'], 'Keys must be unique');
        }),
    }),
    marquee: z.object({
      enabled: z.boolean(),
      items: z
        .array(tagSchema)
        .min(4)
        .max(24)
        .superRefine((items, context) => {
          reportDuplicates(items, context, (index) => [index]);
        }),
    }),
  });

export type HeroSection = z.infer<typeof heroSectionSchema>;
