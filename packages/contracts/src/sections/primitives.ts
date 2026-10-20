/**
 * Shared section payload primitives (`section-engine` spec → Shared payload primitives;
 * `section-engine.T01`). Canonical owner of these shapes (`ownership_index.md`): every section
 * payload schema composes them, so a heading, a metric or a link is validated identically in
 * every section and in the CMS forms that reuse these schemas.
 *
 * Free text always goes through `plainText` (HTML and control characters stripped on write).
 */
import { z } from 'zod';

import { plainText } from '../common/plain-text.js';

/** Longest stored URL. */
export const URL_MAX_LENGTH = 2_048;

/**
 * A stored link: `https:` or `mailto:` only (`constitution.md` → URLs), validated on write and
 * again at publish. `http:`, `javascript:` and relative URLs are refused.
 */
export const safeUrlSchema = z
  .url({ protocol: /^(https|mailto)$/, error: 'Links must start with https: or mailto:' })
  .max(URL_MAX_LENGTH)
  // A bare `mailto:` parses as a URL; it must name an address.
  .refine(
    (value) => !value.toLowerCase().startsWith('mailto:') || /^mailto:[^\s@]+@[^\s@]+$/i.test(value),
    'A mailto: link needs an email address',
  );

/** An `https:` link only — project, certification and social links (`http:` and `mailto:` refused). */
export const httpsUrlSchema = z
  .url({ protocol: /^https$/, error: 'Links must start with https:' })
  .max(URL_MAX_LENGTH);

/**
 * An identifier as code shows it (`hero` code card): a letter or underscore, then letters, digits
 * or underscores, at most `max` characters.
 */
export function identifierSchema(max: number) {
  return z
    .string()
    .max(max)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Use letters, digits and underscores, starting with a letter');
}

/** Adds an issue at each repeated value of `values` (unique tags, keys, items). */
export function reportDuplicates(
  values: readonly string[],
  context: z.RefinementCtx,
  path: (index: number) => (string | number)[],
  message = 'Listed twice',
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    const key = value.toLowerCase();
    if (seen.has(key)) context.addIssue({ code: 'custom', path: path(index), message });
    seen.add(key);
  });
}

/** `EmphasisHeading` — a plain lead and an emphasis rendered in the italic serif accent. */
export const emphasisHeadingSchema = z.object({
  lead: plainText(80),
  emphasis: plainText(48, { min: 0 }),
});

/** `SectionMeta` — the section's eyebrow and its navigation entry. */
export const sectionMetaSchema = z.object({
  eyebrow: plainText(32),
  navLabel: plainText(16),
  showInNav: z.boolean(),
});

/** `Metric` — a short value and what it measures. */
export const metricSchema = z.object({
  value: plainText(12),
  label: plainText(80),
});

/** `Tag` — one chip of text. */
export const tagSchema = plainText(24);

/**
 * `ItemId` — server-assigned when absent, unique within its list, never changed. Bounded so a
 * client cannot store an oversized key; URL-safe characters only.
 */
export const itemIdSchema = z
  .string()
  .min(1)
  .max(32)
  .regex(/^[\w-]+$/);

/**
 * A list item: the item's own fields plus an optional `id`. Every object inside an array in a
 * section payload is built with this helper, which is how the engine knows to assign ids
 * (`section-engine` spec → Shared payload primitives).
 */
export function listItem<Shape extends z.ZodRawShape>(shape: Shape) {
  return z.object({ id: itemIdSchema.optional(), ...shape });
}

/** `LinkTarget` — another section of the page, or an external `https:`/`mailto:` link. */
export const linkTargetSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('section'), sectionType: z.string().min(1).max(32) }),
  z.object({ kind: z.literal('url'), url: safeUrlSchema }),
]);

export type EmphasisHeading = z.infer<typeof emphasisHeadingSchema>;
export type SectionMeta = z.infer<typeof sectionMetaSchema>;
export type Metric = z.infer<typeof metricSchema>;
export type LinkTarget = z.infer<typeof linkTargetSchema>;
