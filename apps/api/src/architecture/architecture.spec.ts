/**
 * `monorepo-foundation.AC9` — the architecture test: the API's real import graph, reduced to
 * module-level edges, must stay inside `architecture.md` → Module dependency map
 * (`constitution.md` → Module boundaries: "a boundary that is only documented is treated as not
 * existing").
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { MODULE_DEPENDENCY_MAP, PUBLIC_SITE_IMPORTS } from './module-dependency-map.js';
import {
  collectEdges,
  findCycles,
  findDisallowedImports,
  findUndeclaredEdges,
  findUnmappedModules,
  readSourceFiles,
  type DependencyMap,
  type SourceFile,
} from './module-graph.js';

const API_SRC = fileURLToPath(new URL('../', import.meta.url));
const ARCHITECTURE_DOC = new URL('../../../../.ai-context/architecture.md', import.meta.url);

/** A two-module map in which neither module may depend on the other. */
const ISOLATED: DependencyMap = { alpha: ['core'], beta: ['core'] };

const file = (path: string, ...imports: string[]): SourceFile => ({
  path,
  text: imports.map((specifier) => `import type { X } from '${specifier}';`).join('\n'),
});

describe('module graph', () => {
  it('monorepo-foundation.IT11 — fails naming an undeclared module edge in a fixture', () => {
    const files = [
      file('modules/alpha/alpha.service.ts', '../beta/index.js'),
      file('modules/beta/index.ts'),
    ];

    expect(findUndeclaredEdges(collectEdges(files), ISOLATED)).toEqual([
      "undeclared dependency alpha → beta: modules/alpha/alpha.service.ts imports '../beta/index.js'",
    ]);
  });

  it('accepts declared edges, core and config imports, and imports inside one module', () => {
    const files = [
      file(
        'modules/alpha/alpha.service.ts',
        '../beta/index.js',
        '../../core/errors/index.js',
        '../../config/env.js',
        './alpha.types.js',
        '@portfolio/contracts',
        'node:fs',
      ),
    ];

    expect(findUndeclaredEdges(collectEdges(files), { alpha: ['core', 'beta'], beta: ['core'] })).toEqual([]);
  });

  it('detects re-exports and dynamic imports, not only import declarations', () => {
    const files: SourceFile[] = [
      { path: 'modules/alpha/a.ts', text: "export * from '../beta/index.js';" },
      { path: 'modules/alpha/b.ts', text: "export const load = () => import('../beta/index.js');" },
    ];

    expect(collectEdges(files).map((edge) => `${edge.from} → ${edge.to}`)).toEqual([
      'alpha → beta',
      'alpha → beta',
    ]);
  });

  it('forbids core from depending on any module', () => {
    const edges = collectEdges([file('core/http/thing.ts', '../../modules/alpha/index.js')]);

    expect(findUndeclaredEdges(edges, ISOLATED)).toEqual([
      "undeclared dependency core → alpha: core/http/thing.ts imports '../../modules/alpha/index.js'",
    ]);
  });

  it('forbids a module from importing the composition root or other top-level files', () => {
    const edges = collectEdges([file('modules/alpha/alpha.routes.ts', '../../container.js')]);

    expect(findUndeclaredEdges(edges, ISOLATED)).toEqual([
      "undeclared dependency alpha → src/container: modules/alpha/alpha.routes.ts imports '../../container.js'",
    ]);
  });

  it('reports a module that is missing from the map', () => {
    const files = [file('modules/gamma/index.ts')];

    expect(findUnmappedModules(files, ISOLATED)).toEqual([
      'module gamma is not in architecture.md → Module dependency map',
    ]);
    expect(findUndeclaredEdges(collectEdges([file('modules/gamma/g.ts', '../alpha/index.js')]), ISOLATED)).toEqual([
      "undeclared dependency gamma → alpha: modules/gamma/g.ts imports '../alpha/index.js'",
    ]);
  });

  it('does not treat test files or composition files as dependencies', () => {
    const files = [
      file('modules/alpha/alpha.service.spec.ts', '../beta/index.js'),
      file('container.ts', './modules/alpha/alpha.service.js', './modules/beta/beta.service.js'),
      file('openapi/check-drift.ts', '../container.js'),
    ];

    expect(collectEdges(files)).toEqual([]);
  });

  it('monorepo-foundation.IT15 — reports a dependency cycle by its path', () => {
    const edges = collectEdges([
      file('modules/alpha/a.ts', '../beta/index.js'),
      file('modules/beta/b.ts', '../alpha/index.js'),
    ]);

    expect(findCycles(edges)).toEqual(['dependency cycle: alpha → beta → alpha']);
  });
});

describe('apps/api', () => {
  const files = readSourceFiles(API_SRC);
  const edges = collectEdges(files);

  it('monorepo-foundation.IT14 — conforms to the module dependency map', () => {
    expect(findUndeclaredEdges(edges, MODULE_DEPENDENCY_MAP)).toEqual([]);
    expect(findUnmappedModules(files, MODULE_DEPENDENCY_MAP)).toEqual([]);
  });

  it('monorepo-foundation.IT15 — has an acyclic module graph (constitution.md → Module boundaries: a DAG)', () => {
    expect(findCycles(edges)).toEqual([]);
  });

  it('public-site-rendering.IT09 — public-site imports nothing from publishing but its read port', () => {
    expect(findDisallowedImports(files, PUBLIC_SITE_IMPORTS)).toEqual([]);
  });

  it('reads the real source tree, including the health module', () => {
    expect(files.some((source) => source.path === 'modules/health/index.ts')).toBe(true);
  });
});

describe('findDisallowedImports', () => {
  const rule = { from: 'public-site', to: 'publishing', names: ['ISnapshotReader'] };

  it('public-site-rendering.IT09 — reports a draft interface imported into public-site (fixture)', () => {
    const fixture: SourceFile = {
      path: 'modules/public-site/public-site.service.ts',
      text: "import type { IDraftContributor, ISnapshotReader } from '../publishing/index.js';\nexport * from '../publishing/index.js';",
    };
    expect(findDisallowedImports([fixture], rule)).toEqual([
      'modules/public-site/public-site.service.ts: IDraftContributor',
      'modules/public-site/public-site.service.ts: *',
    ]);
  });

  it('accepts the allowed name, other modules and specs', () => {
    const files: SourceFile[] = [
      { path: 'modules/public-site/a.ts', text: "import type { ISnapshotReader as Reader } from '../publishing/index.js';" },
      { path: 'modules/public-site/b.ts', text: "import * as assets from '../assets/index.js';" },
      { path: 'modules/public-site/a.spec.ts', text: "import { PublishingService } from '../publishing/publishing.service.js';" },
      { path: 'modules/design/c.ts', text: "import type { IDraftContributor } from '../publishing/index.js';" },
    ];
    expect(findDisallowedImports(files, rule)).toEqual([]);
  });
});

describe('MODULE_DEPENDENCY_MAP', () => {
  it('monorepo-foundation.IT14 — lists exactly the modules of architecture.md → API modules', () => {
    // Only the "## API modules" section: other tables there also start rows with a code span.
    const section = /^## API modules\n([\s\S]*?)^## /m.exec(readFileSync(ARCHITECTURE_DOC, 'utf8'))?.[1] ?? '';
    const documented = [...section.matchAll(/^\| `([a-z-]+)` \|/gm)].map((match) => match[1]);

    expect(documented.length).toBeGreaterThan(0);

    expect(Object.keys(MODULE_DEPENDENCY_MAP).sort()).toEqual(documented.sort());
  });

  it('names only known modules (or core) as dependencies', () => {
    const known = new Set([...Object.keys(MODULE_DEPENDENCY_MAP), 'core']);
    const unknown = Object.values(MODULE_DEPENDENCY_MAP)
      .flat()
      .filter((dependency) => !known.has(dependency));

    expect(unknown).toEqual([]);
  });
});
