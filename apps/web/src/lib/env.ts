/**
 * Validated server-side configuration for `apps/web`.
 *
 * The only file in the web app that reads `process.env` (`architecture.md` → Environment). It
 * parses the environment once with zod and hands back a frozen, typed `WebEnv`. Values here are
 * server-only: nothing in this schema is a `NEXT_PUBLIC_*` variable, so none of it is inlined
 * into the browser bundle.
 *
 * The variable list is owned by `architecture.md` → Environment. Only the variables a finished
 * task actually consumes are declared here; each later spec adds its own in the same change.
 */
import { z } from 'zod';

const envSchema = z.object({
  /**
   * Base URL of `apps/api` as reached from the Next.js server. The `/api/v1` rewrite proxies
   * browser requests here, and server-side fetches use it directly (`int-standards.nextjs.md`
   * → API access).
   */
  API_INTERNAL_URL: z.url({ protocol: /^https?$/ }),
});

/** The validated, read-only configuration object. */
export type WebEnv = Readonly<z.infer<typeof envSchema>>;

/**
 * Raised when the environment fails validation.
 *
 * Carries the offending variable **names** only. Values are never copied into the message or
 * the error object, because a rejected value can still be a secret (a URL with credentials in
 * it) — `constitution.md` → PII / logging rules.
 */
export class WebEnvValidationError extends Error {
  /** Names of the variables that are missing or malformed, in schema order. */
  readonly variables: readonly string[];

  constructor(variables: readonly string[]) {
    super(`Invalid web environment configuration: ${variables.join(', ')}`);
    this.name = 'WebEnvValidationError';
    this.variables = Object.freeze([...variables]);
  }
}

/**
 * Parses and validates the environment.
 *
 * @param source - The raw variables to validate. Defaults to `process.env`; tests pass a plain
 *   object instead so they never mutate the real environment.
 * @returns A frozen `WebEnv`.
 * @throws {WebEnvValidationError} When any variable is missing or malformed.
 */
export function loadEnv(
  source: Readonly<Record<string, string | undefined>> = process.env,
): WebEnv {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    // Keep only the variable name of each issue; zod's messages are dropped on purpose so no
    // part of a rejected value can leak into build or server logs.
    const names = new Set(result.error.issues.map((issue) => String(issue.path[0])));
    throw new WebEnvValidationError([...names]);
  }

  return Object.freeze(result.data);
}
