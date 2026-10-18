/**
 * Validated runtime configuration for `apps/api`.
 *
 * This is the only file in the API that reads `process.env` (`int-standards.express.md` →
 * Configuration). It parses the environment once with zod and hands back a frozen, typed `Env`
 * that the startup sequence passes on explicitly — nothing else reaches into the environment.
 *
 * The variable list is owned by `architecture.md` → Environment. Only the variables a finished
 * task actually consumes are declared here; each later spec adds its own in the same change.
 */
import { z } from 'zod';

/** Accepted MongoDB connection-string schemes (standard and DNS seed list). */
const MONGODB_URI_PATTERN = /^mongodb(\+srv)?:\/\//;

/** Accepted Redis URL schemes (plain and TLS). */
const REDIS_URL_PATTERN = /^rediss?:\/\//;

/**
 * Shortest accepted access-token secret: HS256 needs at least 256 bits of key. `JwtTokenIssuer`
 * enforces the same floor; checking it here as well makes a short secret fail startup by name,
 * like every other bad variable, instead of as a bare error while the container is built.
 */
const MIN_JWT_SECRET_LENGTH = 32;

/**
 * True when `value` is a bare `http(s)` origin in the exact form a browser sends in its `Origin`
 * header — `https://example.com`, `http://127.0.0.1:3000` — with no path, query or trailing
 * slash. `OriginAllowListMiddleware` compares strings, so a value with any of those would never
 * match and every write would be refused; rejecting it at startup names the mistake instead.
 */
function isBareOrigin(value: string): boolean {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.origin === value;
}

/**
 * An optional variable: absent and blank both mean unset. `.env.example` ships optional
 * variables as `NAME=` lines, so a straight copy must parse as "not configured", not as an
 * empty value that fails its schema.
 */
function optional<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => (value === '' ? undefined : value), schema.optional());
}

const envSchema = z.object({
  /** Runtime mode. `production` switches off development-only behaviour (connection caching). */
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** TCP port the HTTP server binds to. */
  PORT: z.coerce.number().int().min(1).max(65_535),
  /** MongoDB connection string. Treated as a secret: it may carry credentials. */
  MONGODB_URI: z.string().regex(MONGODB_URI_PATTERN),
  /**
   * Redis URL for the `auth` session and one-time-code reference store (ADR-0008). Treated as a
   * secret: it may carry a password. A trailing `/<n>` selects the logical database.
   */
  REDIS_URL: z.string().regex(REDIS_URL_PATTERN),
  /**
   * Signs and verifies the access token (HS256; `owner-auth` spec → Session contract). A secret:
   * never logged. Rotating it signs every browser out at its next request.
   */
  JWT_ACCESS_SECRET: z.string().min(MIN_JWT_SECRET_LENGTH),
  /**
   * The web app's origin: the only `Origin` allowed to send a non-GET request to `/api/v1/auth`
   * or `/api/v1/cms` (`owner-auth` spec → Session contract, Origin allow-list).
   */
  WEB_ORIGIN: z.string().refine(isBareOrigin),
  /**
   * The Gmail account the Gmail mail strategy signs in as (ADR-0009). With
   * `GMAIL_APP_PASSWORD`, it selects that strategy; `MailSenderFactory` decides what happens
   * when either is unset.
   */
  GMAIL_USER: optional(z.email()),
  /** A Gmail app password for `GMAIL_USER` — never the account password. A secret. */
  GMAIL_APP_PASSWORD: optional(z.string()),
  /** The sender address on outgoing mail; the Gmail strategy falls back to `GMAIL_USER`. */
  MAIL_FROM: optional(z.email()),
});

/** The validated, read-only configuration object. */
export type Env = Readonly<z.infer<typeof envSchema>>;

/**
 * Raised when the environment fails validation.
 *
 * Carries the offending variable **names** only. Values are never copied into the message or
 * the error object, because a rejected value can still be a secret (a mistyped connection string
 * with a password in it) — `constitution.md` → PII / logging rules.
 */
export class EnvValidationError extends Error {
  /** Names of the variables that are missing or malformed, in schema order. */
  readonly variables: readonly string[];

  constructor(variables: readonly string[]) {
    super(`Invalid environment configuration: ${variables.join(', ')}`);
    this.name = 'EnvValidationError';
    this.variables = Object.freeze([...variables]);
  }
}

/**
 * Parses and validates the environment.
 *
 * @param source - The raw variables to validate. Defaults to `process.env`; tests pass a plain
 *   object instead so they never mutate the real environment.
 * @returns A frozen `Env`.
 * @throws {EnvValidationError} When any variable is missing or malformed.
 */
export function loadEnv(source: Readonly<Record<string, string | undefined>> = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    // Keep only the variable name of each issue; zod's messages are dropped on purpose so no
    // part of a rejected value can leak into logs.
    const names = new Set(result.error.issues.map((issue) => String(issue.path[0])));
    throw new EnvValidationError([...names]);
  }

  return Object.freeze(result.data);
}
