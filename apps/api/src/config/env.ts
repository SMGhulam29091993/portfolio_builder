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

const envSchema = z.object({
  /** Runtime mode. `production` switches off development-only behaviour (connection caching). */
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** TCP port the HTTP server binds to. */
  PORT: z.coerce.number().int().min(1).max(65_535),
  /** MongoDB connection string. Treated as a secret: it may carry credentials. */
  MONGODB_URI: z.string().regex(MONGODB_URI_PATTERN),
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
