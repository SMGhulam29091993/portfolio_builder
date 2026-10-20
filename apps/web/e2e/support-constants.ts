/**
 * Values shared by the E2E harness process (`start-api.ts`) and the specs. Placeholders only:
 * every account lives in a throwaway database for one run.
 */

/** The seeded development account: verified, and the platform owner. */
export const E2E_OWNER = Object.freeze({
  email: 'e2e-owner@portfolio.test',
  password: 'e2e-owner-password-0001',
  displayName: 'Owner',
});

/** The mailbox endpoint's port (`start-api.ts`). */
export const E2E_MAILBOX_PORT = 4199;
