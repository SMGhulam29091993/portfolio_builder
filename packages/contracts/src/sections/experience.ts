/** The `experience` payload (`experience-timeline` spec → API Contract). */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import { emphasisHeadingSchema, listItem, sectionMetaSchema } from './primitives.js';

/** A month: years from 1970 to next year, checked at validation time (not at module load). */
export const yearMonthSchema = z
  .object({ year: z.number().int().min(1970), month: z.number().int().min(1).max(12) })
  .refine((value) => value.year <= new Date().getUTCFullYear() + 1, { path: ['year'], message: 'Too far in the future' });

// The date rule sits on the entry, so it is reported alongside any other problem.
const entrySchema = listItem({
  company: plainText(80),
  role: plainText(80),
  location: plainText(60, { min: 0 }).optional(),
  start: yearMonthSchema,
  /** `null` — the role is current. */
  end: yearMonthSchema.nullable(),
  highlights: z.array(plainText(220)).min(1).max(6),
}).superRefine((entry, context) => {
  if (entry.end && entry.end.year * 12 + entry.end.month < entry.start.year * 12 + entry.start.month) {
    context.addIssue({ code: 'custom', path: ['end'], message: 'The end cannot be before the start' });
  }
});

export const experienceSectionSchema = z.object({
  meta: sectionMetaSchema,
  heading: emphasisHeadingSchema,
  presentLabel: plainText(16),
  entries: z.array(entrySchema).min(1).max(12),
});

export type ExperienceSection = z.infer<typeof experienceSectionSchema>;
export type YearMonth = z.infer<typeof yearMonthSchema>;
