// @ts-check
/**
 * `portfolio/no-instantiation-outside-container` — `monorepo-foundation.AC9` (d).
 *
 * Services, repositories, controllers and adapters are instantiated only in `container.ts`
 * (`constitution.md` → Composition root); everything else receives them through its constructor.
 * The API config exempts `container.ts` and test files.
 *
 * A `new` expression is reported when the class it constructs
 *   1. is declared in first-party source under `src/modules/` — where those four roles live — and
 *   2. is named `*Controller`, `*Service` or `*Repository`, or implements an interface (how an
 *      adapter is recognised: `GridFsFileStorage implements IFileStorage`).
 *
 * Deliberately out of scope, so legitimate code stays legal:
 *   - core infrastructure (`JsonLogger`, `MongoConnection`, `ApplicationLifecycle`), which
 *     `main.ts` and the drift check build before the container exists — see
 *     `.ai-context/memory/review-findings.md`, 2026-10-15
 *   - module classes that implement nothing: errors, streams and other per-request helpers
 *   - library and built-in classes (`Map`, `URL`, `Transform`)
 *
 * Needs type information to follow an import back to the class declaration.
 */
import ts from 'typescript';

import { moduleOf } from '../paths.js';

/** Class-name suffixes that mark a wired role by naming convention. */
const ROLE_SUFFIX = /(Controller|Service|Repository)$/;

/**
 * Follows `expression` (as in `new expression()`) to the class it names, through import aliases.
 *
 * @param {ts.TypeChecker} checker
 * @param {ts.Expression} expression
 * @returns {ts.ClassDeclaration | undefined}
 */
function classDeclarationOf(checker, expression) {
  let symbol = checker.getSymbolAtLocation(expression);
  if (symbol && symbol.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return symbol?.declarations?.find(ts.isClassDeclaration);
}

/**
 * Describes why a class counts as wired, or returns `undefined` when it does not.
 *
 * @param {ts.ClassDeclaration} declaration
 */
function wiredRole(declaration) {
  const suffix = ROLE_SUFFIX.exec(declaration.name?.text ?? '')?.[1];
  if (suffix) return `a ${suffix.toLowerCase()}`;

  const implemented = declaration.heritageClauses?.find(
    (clause) => clause.token === ts.SyntaxKind.ImplementsKeyword,
  );
  if (!implemented) return undefined;
  const ports = implemented.types.map((type) => type.expression.getText()).join(', ');
  return `an adapter (it implements ${ports})`;
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid instantiating wired classes outside container.ts' },
    schema: [],
    messages: {
      wiredOutsideContainer:
        "'{{name}}' is {{role}}: only container.ts (or a test) may instantiate it — receive it " +
        'through the constructor instead (constitution.md → Composition root).',
    },
  },

  create(context) {
    const services = context.sourceCode.parserServices;
    if (!services?.program || !services.esTreeNodeToTSNodeMap) {
      // Fail loudly: silently skipping would make the boundary look enforced when it is not.
      throw new Error(
        'portfolio/no-instantiation-outside-container needs type information — enable ' +
          'parserOptions.projectService for this file.',
      );
    }
    const checker = services.program.getTypeChecker();
    const toTsNode = services.esTreeNodeToTSNodeMap;

    return {
      NewExpression(node) {
        const newExpression = /** @type {ts.NewExpression} */ (toTsNode.get(node));
        const declaration = classDeclarationOf(checker, newExpression.expression);
        if (!declaration) return;

        const sourceFile = declaration.getSourceFile();
        if (sourceFile.isDeclarationFile || !moduleOf(sourceFile.fileName)) return;

        const role = wiredRole(declaration);
        if (!role) return;

        context.report({
          node,
          messageId: 'wiredOutsideContainer',
          data: { name: declaration.name?.text ?? 'anonymous class', role },
        });
      },
    };
  },
};
