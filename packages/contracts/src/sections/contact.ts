/** The `contact` payload (`contact-section` spec → API Contract). The address is the identity's. */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import { emphasisHeadingSchema, sectionMetaSchema } from './primitives.js';

export const contactSectionSchema = z.object({
  meta: sectionMetaSchema,
  heading: emphasisHeadingSchema,
  body: plainText(200, { min: 0 }).optional(),
  emailCta: z.object({ label: plainText(24), subject: plainText(120, { min: 0 }).optional() }),
  showCopyEmail: z.boolean(),
  showSocialLinks: z.boolean(),
});

export type ContactSection = z.infer<typeof contactSectionSchema>;
