import { describe, expect, it } from 'vitest';

import { healthReportSchema } from './health-report.js';

describe('healthReportSchema', () => {
  it('accepts the API01 success payload', () => {
    const report = { status: 'ok', db: 'up', version: '0.0.0', uptimeSec: 12 };

    expect(healthReportSchema.parse(report)).toEqual(report);
  });

  it.each([
    ['db down', { status: 'ok', db: 'down', version: '0.0.0', uptimeSec: 1 }],
    ['fractional uptime', { status: 'ok', db: 'up', version: '0.0.0', uptimeSec: 1.5 }],
    ['empty version', { status: 'ok', db: 'up', version: '', uptimeSec: 1 }],
  ])('rejects %s', (_case, report) => {
    expect(healthReportSchema.safeParse(report).success).toBe(false);
  });
});
