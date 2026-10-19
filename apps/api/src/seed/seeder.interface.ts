/**
 * The seeder port (`owner-auth` plan → Architecture Approach). A seeder writes the stored records
 * a fresh database needs, through the same repositories the API uses, and is idempotent: a
 * second run changes nothing (`constitution.md` → Security Posture: responses are backed by
 * records "created through schemas and idempotent seeders").
 *
 * `OwnerSeeder` (`owner-auth.T09`) is the first implementation; the reference portfolio's
 * content seeder (`apps/api/src/seed/data/`) follows with `section-engine`.
 */

/** What one run did. */
export type SeedOutcome = 'created' | 'unchanged';

export interface ISeeder {
  /**
   * Writes the seeder's records, or nothing when they already exist.
   *
   * @throws {SeedRefusedError} The seeder may not run in this environment.
   * @throws {SeedConfigurationError} A variable the seeder needs is missing or invalid.
   */
  run(): Promise<SeedOutcome>;
}
