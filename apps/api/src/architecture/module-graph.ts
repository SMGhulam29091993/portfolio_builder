/**
 * Reduces the API's import graph to module-level edges and checks them against the module
 * dependency map (`monorepo-foundation.AC9`; `constitution.md` → Module boundaries).
 *
 * The lint rules guard single imports (*how* a module is imported). This file guards the graph
 * (*whether* one module may depend on another at all, and that the whole stays acyclic).
 *
 * Graph nodes:
 *   - each folder under `src/modules/` is one module
 *   - `src/core/` and `src/config/` together are `core` — the plan places `config/env.ts` in the
 *     core layer, and every module may depend on core
 *   - any other top-level file or folder (`container.ts`, `app.ts`, `main.ts`, `openapi/`, …) is
 *     `src/<name>` — composition and tooling, which may import anything but which no module or
 *     core file may import
 *
 * Dev tooling only: excluded from the build like `src/openapi/`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import ts from 'typescript';

/** A source file, with `path` relative to `src/` in POSIX form (`modules/health/index.ts`). */
export interface SourceFile {
  readonly path: string;
  readonly text: string;
}

/** One import that crosses from one graph node to another. */
export interface ModuleEdge {
  readonly from: string;
  readonly to: string;
  /** The importing file, for the failure message. */
  readonly file: string;
  /** The specifier as written. */
  readonly specifier: string;
}

/** Module name → the nodes it may depend on (module names or `core`). */
export type DependencyMap = Readonly<Record<string, readonly string[]>>;

/** The node for `src/core/` and `src/config/`. */
export const CORE = 'core';

/** The node for a relative import that leaves `src/` (for example `../../package.json`). */
const OUTSIDE_SRC = 'outside src';

/** Prefix of composition and tooling nodes; they are never the source of a checked edge. */
const TOP_LEVEL_PREFIX = 'src/';

/** Maps a path relative to `src/` to its graph node. */
function nodeOf(srcRelativePath: string): string {
  if (srcRelativePath.startsWith('../')) return OUTSIDE_SRC;

  const segments = srcRelativePath.split('/');
  const [first = '', second] = segments;
  if (first === 'modules' && second !== undefined && segments.length > 2) return second;
  if (first === 'core' || first === 'config') return CORE;
  return `${TOP_LEVEL_PREFIX}${first.replace(/\.[cm]?[jt]s$/, '')}`;
}

/** `true` for nodes whose outgoing edges the dependency map governs: modules and core. */
function isGoverned(node: string): boolean {
  return node !== OUTSIDE_SRC && !node.startsWith(TOP_LEVEL_PREFIX);
}

/** Tests are not dependencies: a spec may import fakes and fixtures from anywhere it needs. */
function isTestFile(srcRelativePath: string): boolean {
  return srcRelativePath.endsWith('.spec.ts');
}

/**
 * Reads every `.ts` file under `srcRoot`.
 *
 * @param srcRoot - Absolute path of the API's `src/` directory.
 */
export function readSourceFiles(srcRoot: string): SourceFile[] {
  return readdirSync(srcRoot, { recursive: true, encoding: 'utf8' })
    .filter((entry) => entry.endsWith('.ts') && !entry.endsWith('.d.ts'))
    .sort()
    .map((entry) => ({
      path: entry.split(path.sep).join('/'),
      text: readFileSync(path.join(srcRoot, entry), 'utf8'),
    }));
}

/**
 * Lists every relative import that leaves its own node, from module and core files only.
 *
 * Uses TypeScript's import pre-processor, which sees import and export declarations (type-only
 * included) and dynamic `import()` without building a program.
 */
export function collectEdges(files: readonly SourceFile[]): ModuleEdge[] {
  const edges: ModuleEdge[] = [];

  for (const file of files) {
    if (isTestFile(file.path)) continue;
    const from = nodeOf(file.path);
    if (!isGoverned(from)) continue;

    const { importedFiles } = ts.preProcessFile(file.text, true, true);
    for (const { fileName: specifier } of importedFiles) {
      // Bare specifiers are packages and built-ins, never another node of this graph.
      if (!specifier.startsWith('.')) continue;

      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), specifier));
      const to = nodeOf(target);
      if (to !== from) edges.push({ from, to, file: file.path, specifier });
    }
  }

  return edges;
}

/**
 * Reports each edge the map does not allow, once per `from → to` pair, naming the first import
 * that creates it. Core may depend on no module; a module absent from the map may depend on nothing.
 */
export function findUndeclaredEdges(edges: readonly ModuleEdge[], map: DependencyMap): string[] {
  const reported = new Set<string>();
  const messages: string[] = [];

  for (const edge of edges) {
    const allowed = edge.from === CORE ? [] : (map[edge.from] ?? []);
    const pair = `${edge.from} → ${edge.to}`;
    if (allowed.includes(edge.to) || reported.has(pair)) continue;

    reported.add(pair);
    messages.push(`undeclared dependency ${pair}: ${edge.file} imports '${edge.specifier}'`);
  }

  return messages;
}

/** Reports module folders that exist in the source tree but are missing from the map. */
export function findUnmappedModules(files: readonly SourceFile[], map: DependencyMap): string[] {
  const modules = new Set(
    files
      .map((file) => nodeOf(file.path))
      .filter((node) => isGoverned(node) && node !== CORE),
  );

  return [...modules]
    .filter((name) => !Object.hasOwn(map, name))
    .sort()
    .map((name) => `module ${name} is not in architecture.md → Module dependency map`);
}

/**
 * Reports every cycle in the actual graph as `dependency cycle: a → b → a`, starting each cycle
 * at its alphabetically first node so the same cycle is reported once.
 */
export function findCycles(edges: readonly ModuleEdge[]): string[] {
  const adjacency = new Map<string, Set<string>>();
  for (const { from, to } of edges) {
    if (!adjacency.has(from)) adjacency.set(from, new Set());
    adjacency.get(from)?.add(to);
  }

  const cycles = new Set<string>();
  const finished = new Set<string>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    const onStack = stack.indexOf(node);
    if (onStack !== -1) {
      cycles.add(describeCycle(stack.slice(onStack)));
      return;
    }
    if (finished.has(node)) return;

    stack.push(node);
    for (const next of [...(adjacency.get(node) ?? [])].sort()) visit(next);
    stack.pop();
    finished.add(node);
  };

  for (const node of [...adjacency.keys()].sort()) visit(node);
  return [...cycles].sort();
}

/** Rotates a cycle to start at its first node alphabetically and renders it closed. */
function describeCycle(nodes: readonly string[]): string {
  const first = nodes.indexOf([...nodes].sort()[0] ?? '');
  const rotated = [...nodes.slice(first), ...nodes.slice(0, first)];
  return `dependency cycle: ${[...rotated, rotated[0]].join(' → ')}`;
}

/** Which names one module may import from another (`public-site-rendering.T01`). */
export interface ImportAllowList {
  readonly from: string;
  readonly to: string;
  readonly names: readonly string[];
}

/**
 * Reports every name `rule.from` imports or re-exports from `rule.to` that the allow-list does
 * not name, as `file: name`. Namespace imports (`* as x`) are reported as `*`, since they reach
 * everything. This is the interface-level half of draft isolation: `public-site` may depend on
 * `publishing`, but only on its read port (`public-site-rendering.IT09`).
 */
export function findDisallowedImports(files: readonly SourceFile[], rule: ImportAllowList): string[] {
  const allowed = new Set(rule.names);
  const found: string[] = [];
  for (const file of files) {
    if (isTestFile(file.path) || nodeOf(file.path) !== rule.from) continue;
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, false);
    for (const statement of source.statements) {
      const isImport = ts.isImportDeclaration(statement);
      if (!isImport && !ts.isExportDeclaration(statement)) continue;
      const specifier = statement.moduleSpecifier;
      if (!specifier || !ts.isStringLiteral(specifier) || !specifier.text.startsWith('.')) continue;
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), specifier.text));
      if (nodeOf(target) !== rule.to) continue;
      for (const name of importedNames(statement)) {
        if (!allowed.has(name)) found.push(`${file.path}: ${name}`);
      }
    }
  }
  return found;
}

/** The names an import or export declaration brings in; `*` for a namespace or bare star. */
function importedNames(statement: ts.ImportDeclaration | ts.ExportDeclaration): string[] {
  if (ts.isExportDeclaration(statement)) {
    const clause = statement.exportClause;
    if (!clause) return ['*'];
    return ts.isNamedExports(clause) ? clause.elements.map((element) => (element.propertyName ?? element.name).text) : ['*'];
  }
  const bindings = statement.importClause?.namedBindings;
  const names: string[] = statement.importClause?.name ? ['default'] : [];
  if (!bindings) return names;
  if (ts.isNamespaceImport(bindings)) return [...names, '*'];
  return [...names, ...bindings.elements.map((element) => (element.propertyName ?? element.name).text)];
}
