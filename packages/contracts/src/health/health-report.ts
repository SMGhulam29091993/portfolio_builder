/**
 * Response payload of `GET /api/v1/health` (`monorepo-foundation.API01`).
 *
 * Shared so the API's response type and any client (ops tooling, the web app's proxy check)
 * read the same definition. A failing probe is not a variant of this payload: it is a
 * `SERVICE_UNAVAILABLE` error envelope with `data.db = "down"`.
 */
import { z } from 'zod';

export const healthReportSchema = z.object({
  /** Always `ok` in a successful report. */
  status: z.literal('ok'),
  /** MongoDB answered its ping within the probe timeout. */
  db: z.literal('up'),
  /** Version of the running API build. */
  version: z.string().min(1),
  /** Whole seconds since the API process started. */
  uptimeSec: z.number().int().nonnegative(),
});

export type HealthReport = z.infer<typeof healthReportSchema>;
