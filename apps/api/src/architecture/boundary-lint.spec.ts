/**
 * `monorepo-foundation.AC9` — the boundary lint rules, exercised through the API's real
 * `eslint.config.js` against the fixture tree in `test-fixtures/boundary-lint/` (see its README).
 *
 * Linting the fixtures with the shipped config — not a hand-built one — proves the rules *and*
 * their wiring: which files each rule covers and which files are exempt.
 */
import { fileURLToPath } from 'node:url';

import { ESLint, type Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';

const API_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const FIXTURE_SRC = fileURLToPath(new URL('../../test-fixtures/boundary-lint/src/', import.meta.url));

/** Only the boundary rules are asserted; the baseline rule set is not under test here. */
const BOUNDARY_RULE_PREFIX = 'portfolio/';

let eslint: ESLint;

beforeAll(() => {
  // `ignore: false` lifts the config's ignore of `test-fixtures/**` for this run only.
  eslint = new ESLint({ cwd: API_ROOT, ignore: false });
});

/** Lints one fixture and returns its boundary-rule messages; fails on any parse error. */
async function boundaryMessages(fixture: string): Promise<Linter.LintMessage[]> {
  const [result] = await eslint.lintFiles([`${FIXTURE_SRC}${fixture}`]);
  if (!result) throw new Error(`ESLint returned no result for ${fixture}`);

  const fatal = result.messages.filter((message) => message.fatal);
  expect(fatal, `${fixture} must parse`).toEqual([]);

  return result.messages.filter((message) => message.ruleId?.startsWith(BOUNDARY_RULE_PREFIX));
}

async function boundaryRuleIds(fixture: string): Promise<(string | null)[]> {
  return (await boundaryMessages(fixture)).map((message) => message.ruleId);
}

describe('boundary lint rules', () => {
  it('monorepo-foundation.IT10 — fails on each of the four violations, naming its rule', async () => {
    const results = {
      a: await boundaryRuleIds('modules/beta/violates-module-boundary.ts'),
      b: await boundaryRuleIds('modules/beta/beta.service.ts'),
      c: await boundaryRuleIds('modules/beta/violates-process-env.ts'),
      d: await boundaryRuleIds('modules/beta/violates-instantiation.ts'),
    };

    expect(results).toEqual({
      a: Array(3).fill('portfolio/module-boundary'),
      b: Array(2).fill('portfolio/no-framework-in-service'),
      c: Array(3).fill('portfolio/no-process-env'),
      d: Array(2).fill('portfolio/no-instantiation-outside-container'),
    });
  });

  it('monorepo-foundation.AC9 (a) — names the imported path and the module to go through', async () => {
    const [first] = await boundaryMessages('modules/beta/violates-module-boundary.ts');

    expect(first?.message).toContain("'../alpha/alpha.types.js'");
    expect(first?.message).toContain('modules/alpha/index.ts');
  });

  it('monorepo-foundation.AC9 (d) — names the class and why it counts as wired', async () => {
    const messages = (await boundaryMessages('modules/beta/violates-instantiation.ts')).map(
      (message) => message.message,
    );

    expect(messages[0]).toContain('BetaRepository');
    expect(messages[1]).toContain('InMemoryBetaStore');
  });

  it('accepts the legal form of every case: index imports, core classes, helpers, errors', async () => {
    expect(await boundaryRuleIds('modules/beta/conforms.ts')).toEqual([]);
  });

  it.each([
    ['the composition root', 'container.ts'],
    ['the configuration reader', 'config/env.ts'],
    ['a test file', 'modules/beta/beta.repository.spec.ts'],
  ])('exempts %s', async (_name, fixture) => {
    expect(await boundaryRuleIds(fixture)).toEqual([]);
  });
});
