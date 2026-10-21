/** The `stack` payload (`stack-credentials` spec → API Contract). */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import { emphasisHeadingSchema, httpsUrlSchema, listItem, reportDuplicates, sectionMetaSchema } from './primitives.js';

/** Years from 1950 to six years ahead, checked at validation time. */
const yearSchema = z
  .number()
  .int()
  .min(1950)
  .refine((year) => year <= new Date().getUTCFullYear() + 6, 'Too far in the future');

// Each rule sits on the narrowest schema that owns it, so every problem is reported at once.
const groupSchema = listItem({ label: plainText(30), items: z.array(plainText(30)).min(1).max(16) }).superRefine((group, context) => {
  reportDuplicates(group.items, context, (item) => ['items', item]);
});

const educationEntrySchema = listItem({
  title: plainText(80),
  institution: plainText(100),
  startYear: yearSchema,
  endYear: yearSchema.nullable(),
  detail: plainText(60, { min: 0 }).optional(),
}).superRefine((entry, context) => {
  if (entry.endYear !== null && entry.endYear < entry.startYear) {
    context.addIssue({ code: 'custom', path: ['endYear'], message: 'The end year cannot be before the start' });
  }
});

export const stackSectionSchema = z.object({
    meta: sectionMetaSchema,
    heading: emphasisHeadingSchema,
    groups: z.array(groupSchema).min(1).max(9),
    education: z.object({
      enabled: z.boolean(),
      label: plainText(32),
      entries: z.array(educationEntrySchema).max(8),
    }),
    certifications: z.object({
      enabled: z.boolean(),
      label: plainText(32),
      entries: z.array(listItem({ name: plainText(80), issuer: plainText(60), url: httpsUrlSchema.nullable() })).max(12),
    }),
  });

export type StackSection = z.infer<typeof stackSectionSchema>;
