/**
 * Process-level tests for the `seed:owner` script: each case spawns `src/seed/seed-owner.ts` as
 * a real child process (through tsx, as `pnpm seed:owner` does) against a real `mongod`, then
 * asserts its exit code, its output and what is in `users` (`owner-auth.IT14`, `IT26`).
 *
 * This exercises the whole path — `loadEnv`, the container's wiring, `UserRepository` and
 * argon2id — which the unit tests in `owner.seeder.spec.ts` replace with fakes.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MongoTestHarness } from '../testing/index.js';

const API_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** The configured account. Neither value may appear in the script's output. */
const OWNER_EMAIL = 'seeded.owner@portfolio.test';
const OWNER_PASSWORD = 'seed-spec-password-0001';

/**
 * Satisfy the rest of `loadEnv`. The script connects to MongoDB only, so `REDIS_URL` needs the
 * right shape and nothing listening.
 */
const BASE_ENV = {
  PORT: '4998',
  REDIS_URL: 'redis://127.0.0.1:1/0',
  JWT_ACCESS_SECRET: 'seed-spec-placeholder-jwt-secret-000000',
  WEB_ORIGIN: 'http://127.0.0.1:3100',
} as const;

/** What a finished run left behind. */
interface SeedRun {
  readonly code: number | null;
  /** Raw stdout + stderr. */
  readonly output: string;
}

let mongo: MongoTestHarness;

beforeAll(async () => {
  mongo = await MongoTestHarness.start();
});

afterEach(async () => {
  await mongo.reset();
});

afterAll(async () => {
  await mongo.stop();
});

/**
 * Runs the script with exactly `env` — nothing is inherited, so no developer variable (and no
 * `apps/api/.env`, which the script does not load in this form) can mask a missing one.
 */
async function runSeed(env: Record<string, string>): Promise<SeedRun> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/seed/seed-owner.ts'], {
    cwd: API_ROOT,
    env: { ...BASE_ENV, MONGODB_URI: mongo.uri, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let output = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));
  child.stderr.setEncoding('utf8').on('data', (chunk: string) => (output += chunk));

  const code = await new Promise<number | null>((resolve) => child.once('exit', resolve));
  return { code, output };
}

/** Every document in `users`, read straight from the collection. */
function storedUsers() {
  return mongo.connection.getConnection().collection('users').find().toArray();
}

describe('seed:owner', () => {
  it('owner-auth.IT14 — creates one argon2id user, and a second run leaves it untouched', async () => {
    const env = { NODE_ENV: 'development', OWNER_EMAIL, OWNER_PASSWORD };

    const first = await runSeed(env);

    expect(first.code).toBe(0);
    const [created, ...others] = await storedUsers();
    expect(others).toHaveLength(0);
    expect(created).toMatchObject({ email: OWNER_EMAIL, displayName: 'Owner' });
    expect(String(created?.passwordHash)).toMatch(/^\$argon2id\$/);

    const second = await runSeed(env);

    expect(second.code).toBe(0);
    const after = await storedUsers();
    expect(after).toHaveLength(1);
    expect(after[0]?.passwordHash).toBe(created?.passwordHash);
    expect(after[0]?.updatedAt).toEqual(created?.updatedAt);
    for (const run of [first, second]) {
      expect(run.output).not.toContain(OWNER_EMAIL);
      expect(run.output).not.toContain(OWNER_PASSWORD);
    }
  });

  it('owner-auth.IT26 — refuses with a non-zero exit in production and creates no user', async () => {
    const run = await runSeed({ NODE_ENV: 'production', OWNER_EMAIL, OWNER_PASSWORD });

    expect(run.code).not.toBe(0);
    expect(await storedUsers()).toHaveLength(0);
    expect(run.output).toContain('production');
    expect(run.output).not.toContain(OWNER_EMAIL);
    expect(run.output).not.toContain(OWNER_PASSWORD);
  });

  it('owner-auth.AC14 — exits non-zero naming OWNER_PASSWORD when it is too short', async () => {
    const shortPassword = 'eleven-char';
    const run = await runSeed({
      NODE_ENV: 'development',
      OWNER_EMAIL,
      OWNER_PASSWORD: shortPassword,
    });

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('OWNER_PASSWORD');
    expect(run.output).not.toContain(shortPassword);
    expect(await storedUsers()).toHaveLength(0);
  });

  it('monorepo-foundation.AC2 — exits non-zero naming an invalid variable, never its value', async () => {
    const run = await runSeed({ NODE_ENV: 'development', OWNER_EMAIL: 'not-an-address' });

    expect(run.code).not.toBe(0);
    expect(run.output).toContain('OWNER_EMAIL');
    expect(run.output).not.toContain('not-an-address');
    expect(await storedUsers()).toHaveLength(0);
  });
});
