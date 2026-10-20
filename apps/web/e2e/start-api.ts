/**
 * E2E harness process: starts a throwaway MongoDB and the built API in front of it, for
 * `playwright.config.ts` → `webServer`. Run directly by Node (type stripping), not by Next.js.
 *
 * Redis has no in-memory server, so the API uses the Redis that `docker-compose.dev.yml` runs
 * locally and CI runs as a service, on logical database 15 — reserved for E2E, so a run never
 * touches development sessions (database 0) or the API unit-test harness (1-14; ADR-0008).
 *
 * The API runs from `apps/api/dist` with exactly the environment it needs — nothing inherited —
 * the same way `apps/api/src/main.spec.ts` isolates its child process. On SIGTERM / SIGINT the
 * API gets its own graceful shutdown first, then MongoDB is stopped.
 *
 * Mail (`cms-panel-shell.T08`): a local SMTP server receives every email the API sends through
 * its `SMTP_URL` strategy (ADR-0009 → SMTP strategy), and a small mailbox endpoint on
 * `<mailbox-port>` hands the messages to the specs (`e2e/support.ts`), so journeys read the real
 * one-time code with no test hook in the API.
 *
 * Before the API starts, `seed:all` (the built `dist/seed/seed-all.js`) creates the development
 * account — verified, and the platform owner — with `E2E_OWNER` below.
 *
 * Usage: `node e2e/start-api.ts <port> <web-origin> <mailbox-port>` — the web origin is the one
 * Playwright opens, the only `Origin` the API accepts on a non-GET under `/auth` and `/cms`
 * (`owner-auth.AC12`).
 */
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fileURLToPath } from 'node:url';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { SMTPServer } from 'smtp-server';

import { E2E_OWNER } from './support-constants.ts';

const API_ROOT = fileURLToPath(new URL('../../api', import.meta.url));

/** The local / CI Redis, database 15 (see above). */
const E2E_REDIS_URL = 'redis://127.0.0.1:6379/15';

/** Signs this throwaway API's access tokens; a fresh value per run, never a real secret. */
const E2E_JWT_ACCESS_SECRET = randomBytes(48).toString('base64url');

const [port, webOrigin, mailboxPort] = process.argv.slice(2);
if (!port || !webOrigin || !mailboxPort) {
  throw new Error('usage: node e2e/start-api.ts <port> <web-origin> <mailbox-port>');
}

/** One received email, as the specs read it. */
interface ReceivedMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

const mailbox: ReceivedMail[] = [];

/** Plain SMTP on loopback, no TLS and no login — nothing leaves the machine. */
const smtp = new SMTPServer({
  secure: false,
  disabledCommands: ['STARTTLS', 'AUTH'],
  logger: false,
  onData: (stream, session, callback) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').replaceAll('\r\n', '\n');
      const split = raw.indexOf('\n\n');
      const headers = raw.slice(0, split);
      const subject = /^subject: (.*)$/im.exec(headers)?.[1] ?? '';
      for (const recipient of session.envelope.rcptTo) {
        mailbox.push({ to: recipient.address.toLowerCase(), subject, text: raw.slice(split + 2) });
      }
      callback();
    });
  },
});
await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
const smtpPort = (smtp.server.address() as AddressInfo).port;

/** `GET /messages?to=<address>` → every message to that address, oldest first. */
const mailboxServer = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');
  const to = url.searchParams.get('to')?.toLowerCase();
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify(mailbox.filter((mail) => !to || mail.to === to)));
});
await new Promise<void>((resolve) => mailboxServer.listen(Number(mailboxPort), '127.0.0.1', resolve));

const mongo = await MongoMemoryServer.create();

/** Exactly what the API (and the seeder) get — nothing inherited from this process. */
const apiEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  PORT: port,
  MONGODB_URI: mongo.getUri(),
  REDIS_URL: E2E_REDIS_URL,
  JWT_ACCESS_SECRET: E2E_JWT_ACCESS_SECRET,
  WEB_ORIGIN: webOrigin,
  SMTP_URL: `smtp://127.0.0.1:${String(smtpPort)}`,
  MAIL_FROM: 'no-reply@portfolio.test',
  OWNER_EMAIL: E2E_OWNER.email,
  OWNER_PASSWORD: E2E_OWNER.password,
};

// The development account, verified and the owner, before the API takes traffic.
const seedExit = await new Promise<number | null>((resolve) => {
  spawn(process.execPath, ['dist/seed/seed-all.js'], { cwd: API_ROOT, env: apiEnv, stdio: 'inherit' }).once(
    'exit',
    resolve,
  );
});
if (seedExit !== 0) throw new Error('seed:all failed for the E2E database');

const api = spawn(process.execPath, ['dist/main.js'], {
  cwd: API_ROOT,
  env: apiEnv,
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
  mailboxServer.close();
  smtp.close();
  process.exit(code);
}

// An API that dies on its own fails the run instead of leaving Playwright waiting.
api.once('exit', (exitCode) => void stop(exitCode ?? 1));
process.once('SIGTERM', () => void stop(0));
process.once('SIGINT', () => void stop(0));
