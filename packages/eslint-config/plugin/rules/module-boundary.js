// @ts-check
/**
 * `portfolio/module-boundary` — `monorepo-foundation.AC9` (a).
 *
 * A module's public surface is `modules/<name>/index.ts`; any other module imports from that file
 * and nowhere deeper (`constitution.md` → Module boundaries). Imports inside one module are free,
 * and so is anything that is not a module (core, config, packages).
 *
 * `container.ts` is exempted in the API config, not here: wiring concrete classes is its job.
 */
import { visitModuleSpecifiers } from '../module-specifiers.js';
import { isModuleIndex, moduleOf, resolveRelative } from '../paths.js';

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: "Forbid importing another module's files other than its index.ts" },
    schema: [],
    messages: {
      deepImport:
        "'{{specifier}}' reaches into module '{{target}}' past its public surface — import from " +
        'modules/{{target}}/index.ts instead (constitution.md → Module boundaries).',
    },
  },

  create(context) {
    const importer = context.filename;
    const ownModule = moduleOf(importer);

    return visitModuleSpecifiers((source, specifier) => {
      const resolved = resolveRelative(importer, specifier);
      if (!resolved) return;

      const target = moduleOf(resolved);
      if (!target || target === ownModule || isModuleIndex(resolved)) return;

      context.report({ node: source, messageId: 'deepImport', data: { specifier, target } });
    });
  },
};
