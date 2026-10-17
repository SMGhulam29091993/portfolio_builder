/**
 * Keeps `apps/api/.env.example` honest — `monorepo-foundation.T10` (AC12: a new developer copies
 * the example and `pnpm dev` starts).
 *
 * Three facts drift silently without a check: the variable table in `architecture.md` →
 * Environment (the canonical list), the example file a developer copies, and the schema in
 * `env.ts` that decides what the API actually reads. This spec ties all three together:
 *   - the example lists exactly the table's API rows, commented or not, each once;
 *   - its uncommented lines are exactly the variables `loadEnv` returns, so "uncommented" keeps
 *     meaning "read today";
 *   - those lines pass `loadEnv`, so a straight copy starts the API.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { loadEnv } from './env.js';

const ARCHITECTURE_DOC = new URL('../../../../.ai-context/architecture.md', import.meta.url);
const ENV_EXAMPLE = new URL('../../.env.example', import.meta.url);

/** A `NAME=value` line, optionally commented out as `# NAME=value`. Prose comments never match. */
const ASSIGNMENT_LINE = /^(#\s*)?([A-Z][A-Z0-9_]*)=(.*)$/;

/** One variable as written in the example file. */
interface ExampleEntry {
  readonly name: string;
  readonly value: string;
  /** `false` when the line is commented out — read by a later spec. */
  readonly active: boolean;
}

/**
 * Returns every variable the `architecture.md` → Environment table assigns to `app`, read from
 * the backticked names in the first column of each row whose second column mentions the app.
 */
function documentedVariables(app: 'api' | 'web'): string[] {
  const section = /^## Environment\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(
    readFileSync(ARCHITECTURE_DOC, 'utf8'),
  )?.[1];
  if (section === undefined) throw new Error('architecture.md has no "## Environment" section');

  return section
    .split('\n')
    .filter((line) => line.startsWith('| `'))
    .flatMap((line) => {
      const [names = '', apps = ''] = line.split('|').slice(1);
      return apps.includes(app) ? [...names.matchAll(/`([A-Z][A-Z0-9_]*)`/g)].map((m) => m[1] ?? '') : [];
    });
}

/** Parses the example file into its assignment lines, commented or not. */
function exampleEntries(): ExampleEntry[] {
  return readFileSync(ENV_EXAMPLE, 'utf8')
    .split('\n')
    .flatMap((line) => {
      const match = ASSIGNMENT_LINE.exec(line.trim());
      if (!match) return [];
      const [, comment, name = '', value = ''] = match;
      return [{ name, value, active: comment === undefined }];
    });
}

/** The uncommented lines as the `source` object `loadEnv` takes. */
function activeSource(entries: readonly ExampleEntry[]): Record<string, string> {
  return Object.fromEntries(entries.filter((e) => e.active).map((e) => [e.name, e.value]));
}

describe('apps/api/.env.example', () => {
  const entries = exampleEntries();

  it('monorepo-foundation.UT14 — lists exactly the API rows of architecture.md → Environment, once each', () => {
    const names = entries.map((e) => e.name);

    expect(new Set(names).size, 'a variable is listed twice').toBe(names.length);
    expect([...names].sort()).toEqual(documentedVariables('api').sort());
  });

  it('monorepo-foundation.UT14 — uncommented lines are exactly the variables env.ts reads', () => {
    const source = activeSource(entries);

    expect(Object.keys(source).sort()).toEqual(Object.keys(loadEnv(source)).sort());
  });

  it('monorepo-foundation.UT14 — a straight copy of the example passes loadEnv', () => {
    expect(() => loadEnv(activeSource(entries))).not.toThrow();
  });
});
