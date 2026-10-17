/**
 * The web origin proxies `/api/v1/**` to the API (`monorepo-foundation.AC12`).
 */
import { expect, test } from '@playwright/test';
import { healthReportSchema } from '@portfolio/contracts';

test('monorepo-foundation.E2E01 / AC12 — /api/v1/health on the web origin returns 200 through the rewrite', async ({
  request,
}) => {
  const response = await request.get('/api/v1/health');

  expect(response.status()).toBe(200);
  // Set by the API's request-id middleware, so the answer came from the API, not from Next.js.
  expect(response.headers()['x-request-id']).toBeTruthy();
  const body = (await response.json()) as { data: unknown };
  expect(healthReportSchema.safeParse(body.data).success).toBe(true);
});
