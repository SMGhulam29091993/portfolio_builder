/**
 * `PublishRuleRegistry` (`publish-pipeline.UT12`, `UT13`; AC17).
 */
import { describe, expect, it } from 'vitest';

import { publishableContent, RecordingLogger } from '../../testing/index.js';
import { PublishRuleRegistry } from './publish-rule.registry.js';
import type { IPublishRule } from './publishing.interface.js';
import { ResumeMissingRule } from './rules/resume-missing.rule.js';

const extra: IPublishRule = {
  id: 'extra-rule',
  severity: 'warning',
  check: () => Promise.resolve([{ rule: 'extra-rule', severity: 'warning', path: 'identity.fullName', message: 'Extra' }]),
};

describe('PublishRuleRegistry', () => {
  it('publish-pipeline.UT12 / AC17 — a newly registered rule’s issues appear', async () => {
    const registry = new PublishRuleRegistry([new ResumeMissingRule(), extra], new RecordingLogger());
    expect((await registry.evaluate(publishableContent())).map((issue) => issue.rule)).toEqual(['extra-rule']);
  });

  it('publish-pipeline.UT13 — a throwing rule becomes an error issue named after it, and is logged', async () => {
    const logger = new RecordingLogger();
    const broken: IPublishRule = { id: 'broken', severity: 'warning', check: () => Promise.reject(new Error('boom')) };
    const issues = await new PublishRuleRegistry([broken, extra], logger).evaluate(publishableContent());
    expect(issues[0]).toMatchObject({ rule: 'broken', severity: 'error' });
    expect(issues).toHaveLength(2);
    expect(logger.entries.some((entry) => entry.message === 'publish rule failed')).toBe(true);
  });

  it('refuses a rule id registered twice', () => {
    expect(() => new PublishRuleRegistry([extra, extra], new RecordingLogger())).toThrow(/extra-rule/);
  });
});
