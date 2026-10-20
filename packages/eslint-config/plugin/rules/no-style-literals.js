// @ts-check
/**
 * `portfolio/no-style-literals` — `design-theme.AC8`.
 *
 * Section renderers take every colour and font from the theme's CSS variables
 * (`int-standards.nextjs.md` → Styling), so a design can change without touching a component.
 * This rule reports, in any string or template text:
 *
 *   a hex colour (`#c0f83c`, `#fff`), an `rgb()` / `rgba()` / `hsl()` / `hsla()` call, and a
 *   `font-family` declaration or a `fontFamily` object key.
 *
 * Tailwind classes that name variables (`bg-[var(--color-accent)]`, `bg-accent`) pass.
 */

const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/;
const FONT_FAMILY = /font-family\s*:/i;

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid colour and font literals in section renderers' },
    schema: [],
    messages: {
      colour: 'Use a theme colour variable instead of a colour literal (design-theme.AC8).',
      font: 'Use a theme font variable instead of a font family (design-theme.AC8).',
    },
  },

  create(context) {
    /** @param {any} node @param {string} text */
    const check = (node, text) => {
      if (COLOR_LITERAL.test(text)) context.report({ node, messageId: 'colour' });
      else if (FONT_FAMILY.test(text)) context.report({ node, messageId: 'font' });
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.raw);
      },
      JSXText(/** @type {any} */ node) {
        check(node, node.value);
      },
      Property(node) {
        const key = /** @type {any} */ (node.key);
        if ((key.type === 'Identifier' && key.name === 'fontFamily') || (key.type === 'Literal' && key.value === 'fontFamily')) {
          context.report({ node, messageId: 'font' });
        }
      },
    };
  },
};
