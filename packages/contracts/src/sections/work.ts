/** The `work` payload (`work-showcase` spec → API Contract). */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import { emphasisHeadingSchema, httpsUrlSchema, listItem, metricSchema, reportDuplicates, sectionMetaSchema, tagSchema } from './primitives.js';

// Each rule sits on the narrowest schema that owns it, so every problem is reported at once.
const projectSchema = listItem({
  title: plainText(60),
  category: plainText(80),
  description: plainText(400, { multiline: true }),
  featured: z.boolean(),
  metrics: z.array(listItem(metricSchema.shape)).max(4),
  tags: z.array(tagSchema).max(10),
  link: httpsUrlSchema.nullable(),
}).superRefine((project, context) => {
  if (!project.featured && project.metrics.length > 2) {
    context.addIssue({ code: 'custom', path: ['metrics'], message: 'At most two metrics unless the project is featured' });
  }
  reportDuplicates(project.tags, context, (tag) => ['tags', tag]);
});

export const workSectionSchema = z.object({
  meta: sectionMetaSchema,
  heading: emphasisHeadingSchema,
  featuredBadge: plainText(16),
  projects: z
    .array(projectSchema)
    .min(1)
    .max(9)
    .superRefine((projects, context) => {
      let featured = 0;
      projects.forEach((project, index) => {
        if (!project.featured) return;
        featured += 1;
        if (featured > 1) context.addIssue({ code: 'custom', path: [index, 'featured'], message: 'Only one project can be featured' });
      });
    }),
});

export type WorkSection = z.infer<typeof workSectionSchema>;
