/**
 * The `Identity` shape (`site-identity` spec → API Contract; canonical owner per
 * `ownership_index.md`) and the payloads of `site-identity.API01`–`API02`. There is no phone
 * field, by design; unknown keys are stripped (AC7).
 */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';
import { EMAIL_MAX_LENGTH } from '../auth/auth-contracts.js';
import { listItem, tagSchema } from '../sections/primitives.js';

export const SOCIAL_PLATFORMS = ['github', 'linkedin', 'x', 'website'] as const;

/** Social links are `https:` only (stricter than section links, which also allow `mailto:`). */
const httpsUrlSchema = z.url({ protocol: /^https$/, error: 'Links must start with https:' }).max(2_048);

/** An asset id, or `null` for none. */
const assetIdOrNull = z.string().min(1).max(64).nullable();

export const identitySchema = z
  .object({
    fullName: plainText(80),
    /** 1–3 upper-case letters or digits, e.g. `GF`. */
    monogram: z.string().regex(/^[A-Z0-9]{1,3}$/, 'Use 1 to 3 capital letters or digits'),
    roleTitle: plainText(80),
    email: z.email().max(EMAIL_MAX_LENGTH).toLowerCase(),
    location: z.object({
      label: plainText(60),
      timezoneLabel: plainText(24).optional(),
    }),
    availability: z.object({ enabled: z.boolean(), label: plainText(48) }),
    socials: z
      .array(listItem({ platform: z.enum(SOCIAL_PLATFORMS), url: httpsUrlSchema }))
      .max(6)
      .superRefine((socials, context) => {
        const seen = new Set<string>();
        socials.forEach((social, index) => {
          if (seen.has(social.platform)) {
            context.addIssue({ code: 'custom', path: [index, 'platform'], message: 'Only one link per platform' });
          }
          seen.add(social.platform);
        });
      }),
    resume: z.object({ assetId: assetIdOrNull, label: plainText(16) }),
    footer: z.object({ copyrightName: plainText(80), builtWith: z.array(tagSchema).max(6) }),
    seo: z.object({ title: plainText(70), description: plainText(160), ogImageAssetId: assetIdOrNull }),
  });

export type Identity = z.infer<typeof identitySchema>;
export type IdentityInput = z.input<typeof identitySchema>;

/** The stored identity as the CMS sees it. `revision: 0` means "not stored yet: the template". */
export const cmsIdentitySchema = z.object({
  revision: z.number().int().min(0),
  updatedAt: z.string().optional(),
  data: identitySchema,
});
export type CmsIdentity = z.infer<typeof cmsIdentitySchema>;

/** `site-identity.API02` — body. `data` is validated against `identitySchema`. */
export const updateIdentityRequestSchema = z.object({
  expectedRevision: z.number().int().min(0),
  data: identitySchema,
});
export type UpdateIdentityRequest = z.infer<typeof updateIdentityRequestSchema>;
