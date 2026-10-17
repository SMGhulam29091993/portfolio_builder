/**
 * E2E harness process: starts a throwaway MongoDB and the built API in front of it, for
 * `playwright.config.ts` → `webServer`. Run directly by Node (type stripping), not by Next.js.
 *
 * The API runs from `apps/api/dist` with exactly the environment it needs — nothing inherited —
 * the same way `apps/api/src/main.spec.ts` isolates its child process. On SIGTERM / SIGINT the
 * API gets its own graceful shutdown first, then MongoDB is stopped.
 *
 * Usage: `node e2e/start-api.ts <port>`
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';

const API_ROOT = fileURLToPath(new URL('../../api', import.meta.url));

const port = process.argv[2];
if (!port) throw new Error('usage: node e2e/start-api.ts <port>');

const mongo = await MongoMemoryServer.create();

const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: API_ROOT,
  env: { NODE_ENV: 'test', PORT: port, MONGODB_URI: mongo.getUri() },
  stdio: 'inherit',
});

let stopping = false;

/** Stops the API (waiting for its exit), then MongoDB, then this process. */
async function stop(code: number): Promise<void> {
  if (stopping) return;
  stopping = true;
  if (api.exitCode === null) {
    const exited = new Promise((resolve) => api.once('exit', resolve));
    api.kill('SIGTERM');
    await exited;
  }
  await mongo.stop();
  process.exit(code);
}

// An API that dies on its own fails the run instead of leaving Playwright waiting.
api.once('exit', (exitCode) => void stop(exitCode ?? 1));
process.once('SIGTERM', () => void stop(0));
process.once('SIGINT', () => void stop(0));
