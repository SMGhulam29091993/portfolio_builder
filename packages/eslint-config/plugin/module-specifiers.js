// @ts-check
/**
 * One visitor for every syntax that names another module, so the import rules cannot miss a form:
 *
 *   import … from 'x'          export … from 'x'          export * from 'x'
 *   import('x')                import x = require('x')
 *
 * Type-only forms (`import type`, `export type … from`) are included on purpose — a type import
 * still couples the importer to the imported file's location.
 */

/**
 * Called once per literal module specifier.
 *
 * @callback SpecifierCallback
 * @param {any} source - The specifier's string-literal AST node, to report on.
 * @param {string} specifier - The specifier text as written.
 * @returns {void}
 */

/** @param {any} node */
function isStringLiteral(node) {
  return node?.type === 'Literal' && typeof node.value === 'string';
}

/**
 * Builds a rule visitor that calls `callback` for each literal module specifier in the file.
 * Dynamic imports with a computed specifier are skipped: they name no fixed module.
 *
 * @param {SpecifierCallback} callback
 * @returns {import('eslint').Rule.RuleListener}
 */
export function visitModuleSpecifiers(callback) {
  /** @param {any} node - A node whose `source` property holds the specifier. */
  const checkSource = (node) => {
    if (isStringLiteral(node.source)) callback(node.source, node.source.value);
  };

  return {
    ImportDeclaration: checkSource,
    ExportNamedDeclaration: checkSource,
    ExportAllDeclaration: checkSource,
    ImportExpression: checkSource,
    // TypeScript's `import x = require('x')` keeps the specifier under `expression`.
    /** @param {any} node */
    TSExternalModuleReference(node) {
      if (isStringLiteral(node.expression)) callback(node.expression, node.expression.value);
    },
  };
}
