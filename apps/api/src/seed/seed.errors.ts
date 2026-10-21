/**
 * Errors a seeder throws instead of writing anything. They are not `AppError`s: a seeder runs
 * from a script, never inside a request, so no HTTP status applies.
 *
 * Both messages name variables and environments only, never a value — the values are an email
 * address and a password (`constitution.md` → PII / logging rules).
 */

/** The seeder may not run here at all — `NODE_ENV=production` (`owner-auth.AC23`). */
export class SeedRefusedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SeedRefusedError';
  }
}

/** A variable the seeder needs is missing or invalid (`owner-auth.AC14`). */
export class SeedConfigurationError extends Error {
  /** The offending variable's name, e.g. `OWNER_PASSWORD`. */
  readonly variable: string;

  /**
   * @param variable - The variable's name.
   * @param problem - What is wrong with it, without its value: `"is not set"`.
   */
  constructor(variable: string, problem: string) {
    super(`${variable} ${problem}`);
    this.name = 'SeedConfigurationError';
    this.variable = variable;
  }
}

/**
 * Seed data that does not satisfy its section's schema, or a list item without the stable id
 * seed data must carry (`section-engine.T06`). A bug in `seed/data/`, never in the environment.
 */
export class SeedDataError extends Error {
  constructor(
    readonly sectionType: string,
    problem: string,
  ) {
    super(`Seed data for section "${sectionType}" ${problem}`);
    this.name = 'SeedDataError';
  }
}
