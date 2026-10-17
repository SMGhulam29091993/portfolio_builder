// @ts-check
/**
 * Asserts that a Turborepo run would be served entirely from cache
 * (`monorepo-foundation.AC1`, test `monorepo-foundation.IT13`).
 *
 * Run it straight after a real `turbo run <tasks>`: it asks Turborepo for a dry run of the same
 * tasks and fails, naming each task, if any would execute instead of replaying its cache. A miss
 * means a task's inputs or outputs are declared wrongly in `turbo.json` (or the task writes into
 * its own inputs), which would make every CI run and local build slower than it needs to be.
 *
 * Usage: `node scripts/check-turbo-cache.mjs build typecheck lint test drift`
 * The environment must match the real run, because declared env vars are part of each hash.
 */
import { execFileSync } from 'node:child_process';

const tasks = process.argv.slice(2);
if (tasks.length === 0) {
  console.error('usage: node scripts/check-turbo-cache.mjs <task> [<task> ...]');
  process.exit(2);
}

/**
 * The fields of `turbo run --dry=json` this check reads.
 * @typedef {{ taskId: string, command: string, cache: { status: 'HIT' | 'MISS' } }} DryRunTask
 */

/** How the dry run marks a package that has no script for the task; such entries never run. */
const NO_SCRIPT = '<NONEXISTENT>';

// `pnpm exec` resolves the workspace's pinned turbo rather than any global install.
const output = execFileSync('pnpm', ['exec', 'turbo', 'run', ...tasks, '--dry=json'], {
  encoding: 'utf8',
  // Turborepo writes its banner to stderr; only the JSON on stdout matters here.
  stdio: ['ignore', 'pipe', 'inherit'],
  maxBuffer: 64 * 1024 * 1024,
});

/** @type {{ tasks: DryRunTask[] }} */
const dryRun = JSON.parse(output);
const runnable = dryRun.tasks.filter((task) => task.command !== NO_SCRIPT);
const misses = runnable.filter((task) => task.cache.status !== 'HIT');

if (misses.length > 0) {
  console.error(
    `${String(misses.length)} of ${String(runnable.length)} tasks would not be served from cache:`,
  );
  for (const task of misses) console.error(`  - ${task.taskId}`);
  process.exit(1);
}

console.log(`All ${String(runnable.length)} tasks are cached.`);
