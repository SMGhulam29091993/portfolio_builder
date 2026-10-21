/**
 * Request and response payloads of the section engine, `section-engine.API01`–`API06`
 * (`.ai-context/specs/section-engine.spec.md` → API Contract), and the portfolio slug rules
 * (spec → Slug rules).
 *
 * Section `data` is `unknown` here on purpose: each type's payload schema is owned by that
 * section's spec, and the engine validates `data` against the registered definition's schema.
 */
import { z } from 'zod';

/** A section type id, e.g. `about`. Lower-case, so it is safe in a URL path. */
export const sectionTypeSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[a-z][a-z0-9-]*$/);

/** A non-negative revision; `0` names a section that has no stored document yet. */
export const revisionSchema = z.number().int().min(0);

/** Slugs that would collide with the platform's own paths (spec → Slug rules). */
export const RESERVED_SLUGS: readonly string[] = Object.freeze([
  'api',
  'cms',
  'admin',
  'login',
  'register',
  '_next',
  'static',
  'assets',
  'favicon.ico',
  'robots.txt',
  'sitemap.xml',
  'health',
  'public',
  'www',
  'app',
  'help',
  'about',
  'pricing',
  'terms',
  'privacy',
]);

/** The slug shape: 3–40 characters, lower-case letters, digits and single inner hyphens. */
export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

export const slugSchema = z
  .string()
  .regex(SLUG_PATTERN)
  .refine((value) => !value.includes('--'), 'Hyphens may not repeat');

/** The portfolio as the CMS sees it. */
export const cmsPortfolioSchema = z.object({
  id: z.string(),
  slug: z.string(),
  revision: revisionSchema,
  /** Orderable types only; `hero` is always rendered first. */
  sectionOrder: z.array(sectionTypeSchema),
});

/** One section as the CMS sees it. */
export const cmsSectionSchema = z.object({
  type: sectionTypeSchema,
  visible: z.boolean(),
  revision: revisionSchema,
  /** ISO-8601; absent for a section that has no stored document yet (AC18). */
  updatedAt: z.string().optional(),
  data: z.unknown(),
});

/** `section-engine.API01` — `data` of `GET /api/v1/cms/portfolio`. */
export const portfolioDraftResponseSchema = z.object({
  portfolio: cmsPortfolioSchema,
  sections: z.array(cmsSectionSchema),
});

/** One entry of `section-engine.API02`. */
export const sectionTypeInfoSchema = z.object({
  type: sectionTypeSchema,
  label: z.string(),
  orderable: z.boolean(),
  hideable: z.boolean(),
  inNav: z.boolean(),
});

/** `section-engine.API02` — `data` of `GET /api/v1/cms/portfolio/section-types`. */
export const sectionTypesResponseSchema = z.object({ types: z.array(sectionTypeInfoSchema) });

/** `section-engine.API03` — params of `PUT /api/v1/cms/portfolio/sections/:type`. */
export const sectionParamsSchema = z.object({ type: sectionTypeSchema });

/** `section-engine.API03` — body. `data` is validated against the type's own schema. */
export const updateSectionRequestSchema = z.object({
  expectedRevision: revisionSchema,
  data: z.unknown(),
});

/** `section-engine.API04` — body of `PATCH …/sections/:type/visibility`. */
export const setVisibilityRequestSchema = z.object({
  expectedRevision: revisionSchema,
  visible: z.boolean(),
});

/** `data` of API03 and API04. */
export const sectionResponseSchema = z.object({ section: cmsSectionSchema });

/** `section-engine.API05` — body of `PUT /api/v1/cms/portfolio/section-order`. */
export const reorderSectionsRequestSchema = z.object({
  expectedRevision: revisionSchema,
  order: z.array(sectionTypeSchema).max(64),
});

/** `section-engine.API06` — body of `PUT /api/v1/cms/portfolio/slug`. */
export const changeSlugRequestSchema = z.object({
  expectedRevision: revisionSchema,
  slug: slugSchema,
});

/** `data` of API05 and API06. */
export const portfolioResponseSchema = z.object({ portfolio: cmsPortfolioSchema });

export type CmsPortfolio = z.infer<typeof cmsPortfolioSchema>;
export type CmsSection = z.infer<typeof cmsSectionSchema>;
export type PortfolioDraftResponse = z.infer<typeof portfolioDraftResponseSchema>;
export type SectionTypeInfo = z.infer<typeof sectionTypeInfoSchema>;
export type UpdateSectionRequest = z.infer<typeof updateSectionRequestSchema>;
export type SetVisibilityRequest = z.infer<typeof setVisibilityRequestSchema>;
export type ReorderSectionsRequest = z.infer<typeof reorderSectionsRequestSchema>;
export type ChangeSlugRequest = z.infer<typeof changeSlugRequestSchema>;
