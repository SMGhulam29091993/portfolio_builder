/**
 * Seed data for the development-only account (`owner-auth.T09`). Kept here, not inline in the
 * seeder, because `constitution.md` → Security Posture places every seeded value under
 * `apps/api/src/seed/data/`.
 *
 * The email and password are never seed data: they come from `OWNER_EMAIL` and
 * `OWNER_PASSWORD`, so no credential is written into the repository.
 */
export const DEV_OWNER = Object.freeze({
  /**
   * A fixed placeholder, chosen by the owner (`owner-auth.OQ1`, resolved 2026-10-19). The user
   * changes it later in the CMS.
   */
  displayName: 'Owner',
});
