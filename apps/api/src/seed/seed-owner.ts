/**
 * `pnpm seed:owner` — creates the development-only account (`owner-auth.T09`; AC13, AC14, AC23).
 *
 * Steps, each failing with exit 1:
 *   1. load and validate the environment, naming any bad variable, never its value
 *   2. connect to MongoDB (Redis is not needed: the seeder writes `users` only)
 *   3. build the seeder in the composition root and run it — in production it refuses before
 *      reading or hashing anything
 *   4. close MongoDB
 *
 * Logs name the outcome or the offending variable only: never the email or password
 * (`constitution.md` → PII / logging rules).
 */
import { EnvValidationError, loadEnv, type Env } from '../config/env.js';
import { buildSeeders } from '../container.js';
import { MongoConnection } from '../core/db/mongo-connection.js';
import { ExitCode } from '../core/lifecycle/application-lifecycle.js';
import { JsonLogger } from '../core/logger/json-logger.js';
import type { ILogger } from '../core/logger/logger.interface.js';
import { SeedConfigurationError, SeedRefusedError } from './seed.errors.js';

/** How long the script waits for MongoDB before giving up. */
const SERVER_SELECTION_TIMEOUT_MS = 5_000;

const logger: ILogger = new JsonLogger(process.stdout);

/** Step 1. Returns `undefined` after logging when the environment is invalid. */
function readEnvironment(): Env | undefined {
  try {
    return loadEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      logger.error('invalid environment configuration', { variables: error.variables });
      return undefined;
    }
    throw error;
  }
}

/** Steps 2–4. Resolves to the process exit code. */
async function seed(env: Env): Promise<ExitCode> {
  const mongo = MongoConnection.getInstance({
    uri: env.MONGODB_URI,
    serverSelectionTimeoutMs: SERVER_SELECTION_TIMEOUT_MS,
    // A one-shot process: no hot reload to survive.
    cacheAcrossReloads: false,
  });

  try {
    await mongo.connect();
    const outcome = await buildSeeders({ env, mongo }).owner.run();
    logger.info('owner seed finished', { outcome });
    return ExitCode.Clean;
  } catch (error) {
    if (error instanceof SeedRefusedError || error instanceof SeedConfigurationError) {
      // Their messages carry variable names only, by construction.
      logger.error('owner seed refused', { reason: error.message });
    } else {
      // Driver errors name the host, not the credentials; the URI itself is never logged.
      logger.error('owner seed failed', { error });
    }
    return ExitCode.Failure;
  } finally {
    await mongo.disconnect();
  }
}

async function main(): Promise<ExitCode> {
  const env = readEnvironment();
  return env ? seed(env) : ExitCode.Failure;
}

// `exitCode` rather than `exit()`, so buffered log output is flushed before the process ends.
main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    logger.error('owner seed failed', { error });
    process.exitCode = ExitCode.Failure;
  },
);
