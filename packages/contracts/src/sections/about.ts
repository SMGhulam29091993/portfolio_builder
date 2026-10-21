/** The `about` payload (`about-section` spec → API Contract). */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import { emphasisHeadingSchema, listItem, metricSchema, sectionMetaSchema } from './primitives.js';

export const aboutSectionSchema = z
  .object({
    meta: sectionMetaSchema,
    heading: emphasisHeadingSchema,
    bio: plainText(600, { multiline: true }),
    currently: z.object({ enabled: z.boolean(), label: plainText(20), text: plainText(120) }),
    stats: z.array(listItem(metricSchema.shape)).max(4),
    // The rule sits on the card itself, so it is reported even when other fields fail too.
    process: z
      .object({
        enabled: z.boolean(),
        eyebrow: plainText(24),
        title: plainText(80),
        note: plainText(160, { min: 0 }).optional(),
        steps: z.array(listItem({ title: plainText(40), description: plainText(140) })).max(4),
      })
      .superRefine((process, context) => {
        // Two to four steps while the process card shows (AC2).
        if (process.enabled && process.steps.length < 2) {
          context.addIssue({ code: 'custom', path: ['steps'], message: 'Add at least two steps, or hide the card' });
        }
      }),
  });

export type AboutSection = z.infer<typeof aboutSectionSchema>;
