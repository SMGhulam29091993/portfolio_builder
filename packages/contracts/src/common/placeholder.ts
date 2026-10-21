/**
 * Placeholder text that must never be published (`publish-pipeline` → Publish rules,
 * `no-placeholder-text`). Two forms:
 *
 * - an upper-case instruction in brackets, eight or more characters — the reference content's
 *   `[ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]`;
 * - a template placeholder, which always starts with "Your" — `[Your headline]`, `[Your tool]`
 *   (`section-engine` → Portfolio provisioning).
 *
 * Ordinary bracketed text such as `[1]` or `[beta]` matches neither. Shared, so the CMS can flag
 * the same text the publish rule blocks.
 */
export const PLACEHOLDER_PATTERN = /\[(?:[A-Z0-9][A-Z0-9 ,.'’:;!?/-]{7,}|Your\b[^\]]*)\]/;

/** `true` when `text` contains placeholder text. */
export function hasPlaceholder(text: string): boolean {
  return PLACEHOLDER_PATTERN.test(text);
}
