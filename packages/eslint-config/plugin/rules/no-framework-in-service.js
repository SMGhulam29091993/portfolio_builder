// @ts-check
/**
 * `portfolio/no-framework-in-service` — `monorepo-foundation.AC9` (b).
 *
 * A service holds business logic only: it must not import Mongoose or `express`
 * (`constitution.md` → Layer responsibilities). Persistence reaches it through a repository
 * interface and HTTP never reaches it at all. Type-only imports count, since they still tie the
 * service to the framework.
 *
 * The API config enables this rule on `*.service.ts`; the rule itself does not look at file names.
 */
import { visitModuleSpecifiers } from '../module-specifiers.js';

/** Packages a service may not import, including their subpaths (`mongoose/…`). */
const DEFAULT_FORBIDDEN = ['express', 'mongoose'];

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid framework and ODM imports in service files' },
    schema: [
      {
        type: 'object',
        properties: {
          forbidden: { type: 'array', items: { type: 'string' }, uniqueItems: true },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      frameworkImport:
        "A service must not import '{{specifier}}' — it receives persistence through a repository " +
        'interface and never sees HTTP (constitution.md → Layer responsibilities).',
    },
  },

  create(context) {
    /** @type {string[]} */
    const forbidden = context.options[0]?.forbidden ?? DEFAULT_FORBIDDEN;
    const isForbidden = (/** @type {string} */ specifier) =>
      forbidden.some((name) => specifier === name || specifier.startsWith(`${name}/`));

    return visitModuleSpecifiers((source, specifier) => {
      if (isForbidden(specifier)) {
        context.report({ node: source, messageId: 'frameworkImport', data: { specifier } });
      }
    });
  },
};
