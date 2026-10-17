// @ts-check
/**
 * `portfolio/no-process-env` — `monorepo-foundation.AC9` (c).
 *
 * `config/env.ts` parses the environment once and every other file receives the frozen `Env`
 * through the container (`int-standards.express.md` → Configuration). This rule catches the
 * three ways code reaches the environment directly:
 *
 *   process.env.X   /   globalThis.process.env.X   /   process['env']
 *   const { env } = process
 *   import { env } from 'node:process'
 *
 * The API config exempts `config/env.ts`.
 */

/** Module names under which Node exposes `process`. */
const PROCESS_MODULES = new Set(['process', 'node:process']);

/** @param {any} node - `true` for `process` and `globalThis.process`. */
function isProcess(node) {
  if (node?.type === 'Identifier') return node.name === 'process';
  return (
    node?.type === 'MemberExpression' &&
    node.object.type === 'Identifier' &&
    node.object.name === 'globalThis' &&
    isKey(node.property, node.computed, 'process')
  );
}

/**
 * @param {any} key - A property key node.
 * @param {boolean} computed - Whether it was written in brackets.
 * @param {string} name - The key to match.
 */
function isKey(key, computed, name) {
  return computed
    ? key.type === 'Literal' && key.value === name
    : key.type === 'Identifier' && key.name === name;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid reading process.env outside config/env.ts' },
    schema: [],
    messages: {
      processEnv:
        'Read configuration from the injected Env, not process.env — only config/env.ts reads ' +
        'the environment (int-standards.express.md → Configuration).',
    },
  },

  create(context) {
    return {
      MemberExpression(node) {
        if (isProcess(node.object) && isKey(node.property, node.computed, 'env')) {
          context.report({ node, messageId: 'processEnv' });
        }
      },

      VariableDeclarator(node) {
        if (node.id.type !== 'ObjectPattern' || !isProcess(node.init)) return;
        for (const property of node.id.properties) {
          if (property.type === 'Property' && isKey(property.key, property.computed, 'env')) {
            context.report({ node: property, messageId: 'processEnv' });
          }
        }
      },

      ImportDeclaration(node) {
        if (!PROCESS_MODULES.has(String(node.source.value))) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportSpecifier' && isKey(specifier.imported, false, 'env')) {
            context.report({ node: specifier, messageId: 'processEnv' });
          }
        }
      },
    };
  },
};

