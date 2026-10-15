/**
 * API process entry point.
 *
 * Runs the startup sequence from `constitution.md` → Infrastructure and fails fast on any step:
 *   1. load and validate the environment — exit 1, naming the bad variables (AC2)
 *   2. connect to MongoDB and confirm it answered — exit 1 without opening a port (AC3)
 *   3. build the container and the Express app
 *   4. listen
 *   5. on SIGTERM / SIGINT, drain in-flight requests, close MongoDB, exit 0 (AC13)
 *
 * Recovering interrupted AI work joins between steps 3 and 4 with `ai-design-studio`.
 */
import { createApp } from './app.js';
import { EnvValidationError, loadEnv, type Env } from './config/env.js';
import { buildContainer } from './container.js';
import { MongoConnection } from './core/db/mongo-connection.js';
import { ApplicationLifecycle, ExitCode } from './core/lifecycle/application-lifecycle.js';
import { JsonLogger } from './core/logger/json-logger.js';
import type { ILogger } from './core/logger/logger.interface.js';

/** How long startup waits for MongoDB before giving up. */
const SERVER_SELECTION_TIMEOUT_MS = 5_000;

/** How long in-flight requests may run after a shutdown signal. */
const SHUTDOWN_GRACE_MS = 10_000;

/** Upper bound on waiting for buffered log output before a forced exit. */
const EXIT_FLUSH_TIMEOUT_MS = 1_000;

const logger: ILogger = new JsonLogger(process.stdout);

/**
 * Ends the process with `code`.
 *
 * Sets `process.exitCode` and lets the event loop drain, so buffered stdout (asynchronous for
 * pipes on macOS) is not truncated. The unref'd timer forces the exit only if some handle keeps
 * the loop alive.
 */
function terminate(code: ExitCode): void {
  process.exitCode = code;
  setTimeout(() => process.exit(code), EXIT_FLUSH_TIMEOUT_MS).unref();
}

/** Step 1. Returns `undefined` after logging when the environment is invalid. */
function readEnvironment(): Env | undefined {
  try {
    return loadEnv();
  } catch (error) {
    if (error instanceof EnvValidationError) {
      // Names only — the rejected values may be secrets (AC2).
      logger.error('invalid environment configuration', { variables: error.variables });
      return undefined;
    }
    throw error;
  }
}

async function main(): Promise<void> {
  const env = readEnvironment();
  if (!env) {
    terminate(ExitCode.Failure);
    return;
  }

  const database = MongoConnection.getInstance({
    uri: env.MONGODB_URI,
    serverSelectionTimeoutMs: SERVER_SELECTION_TIMEOUT_MS,
    cacheAcrossReloads: env.NODE_ENV !== 'production',
  });

  // Built only after MongoDB has answered (step 3 follows step 2).
  const createRequestListener = () =>
    createApp(buildContainer({ env, logger, mongo: database })).handler;

  const lifecycle = new ApplicationLifecycle(database, createRequestListener, logger, {
    port: env.PORT,
    shutdownGraceMs: SHUTDOWN_GRACE_MS,
  });

  try {
    await lifecycle.start();
  } catch (error) {
    // Driver errors name the host, not the credentials, and the URI itself is never logged —
    // `main.spec.ts` asserts no part of the secret reaches the output.
    logger.error('startup failed', { error });
    await database.disconnect();
    terminate(ExitCode.Failure);
    return;
  }

  const onSignal = (signal: NodeJS.Signals): void => {
    void lifecycle.stop(signal).then(terminate);
  };
  process.once('SIGTERM', onSignal);
  process.once('SIGINT', onSignal);
}

main().catch((error: unknown) => {
  logger.error('startup failed', { error });
  terminate(ExitCode.Failure);
});
