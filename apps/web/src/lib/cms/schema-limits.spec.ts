/** `fieldLimits` — `cms-panel-shell.UT12`. */
import { listItem, metricSchema, plainText } from '@portfolio/contracts';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { fieldLimits } from './schema-limits';

const schema = z.object({
  heading: plainText(80),
  note: plainText(48, { min: 0 }).optional(),
  metrics: z.array(metricSchema).min(1).max(4),
  items: z.array(listItem({ title: plainText(20) })).max(6),
  secret: z.string().max(10).transform((value) => value).optional(),
});

describe('fieldLimits (cms-panel-shell.UT12)', () => {
  it('reads string limits through plainText pipes and optional wrappers', () => {
    expect(fieldLimits(schema, 'heading')).toEqual({ minLength: 1, maxLength: 80 });
    expect(fieldLimits(schema, 'note')).toEqual({ minLength: 0, maxLength: 48 });
    expect(fieldLimits(schema, 'secret')).toEqual({ maxLength: 10 });
  });

  it('reads array limits and steps into list items', () => {
    expect(fieldLimits(schema, 'metrics')).toEqual({ minItems: 1, maxItems: 4 });
    expect(fieldLimits(schema, 'metrics.0.value')).toEqual({ minLength: 1, maxLength: 12 });
    expect(fieldLimits(schema, 'items.3.title')).toEqual({ minLength: 1, maxLength: 20 });
  });

  it('answers nothing for an unknown path', () => {
    expect(fieldLimits(schema, 'missing.path')).toEqual({});
  });
});
