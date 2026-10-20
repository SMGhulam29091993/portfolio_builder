/** Shared section primitives and engine schemas (`section-engine.T01`; AC4, AC7 variations). */
import { describe, expect, it } from 'vitest';

import { changeSlugRequestSchema, reorderSectionsRequestSchema } from './engine.js';
import {
  emphasisHeadingSchema,
  itemIdSchema,
  linkTargetSchema,
  listItem,
  metricSchema,
  safeUrlSchema,
  sectionMetaSchema,
} from './primitives.js';
import { plainText } from '../common/plain-text.js';

describe('safeUrlSchema', () => {
  it.each(['https://github.com/x', 'mailto:someone@example.test'])('accepts %s', (url) => {
    expect(safeUrlSchema.safeParse(url).success).toBe(true);
  });

  it.each(['http://example.test', 'javascript:alert(1)', '/relative', 'ftp://x', 'mailto:', `https://x/${'a'.repeat(2048)}`])(
    'rejects %s',
    (url) => {
      expect(safeUrlSchema.safeParse(url).success).toBe(false);
    },
  );
});

describe('primitives', () => {
  it('cleans and bounds an emphasis heading; the emphasis may be empty', () => {
    expect(emphasisHeadingSchema.parse({ lead: '<b>Systems</b> that run', emphasis: '' })).toEqual({
      lead: 'Systems that run',
      emphasis: '',
    });
    expect(emphasisHeadingSchema.safeParse({ lead: 'x'.repeat(81), emphasis: '' }).success).toBe(false);
  });

  it('bounds the section meta and metric fields', () => {
    expect(sectionMetaSchema.safeParse({ eyebrow: '01 — ABOUT', navLabel: 'About', showInNav: true }).success).toBe(true);
    expect(sectionMetaSchema.safeParse({ eyebrow: 'e', navLabel: 'n'.repeat(17), showInNav: true }).success).toBe(false);
    expect(metricSchema.safeParse({ value: '1234567890123', label: 'x' }).success).toBe(false);
  });

  it('section-engine.AC7 — list items take an optional, bounded id', () => {
    const item = listItem({ title: plainText(10) });

    expect(item.parse({ title: 'A' })).toEqual({ title: 'A' });
    expect(item.parse({ id: 'abc-123_X', title: 'A' })).toEqual({ id: 'abc-123_X', title: 'A' });
    expect(itemIdSchema.safeParse('has space').success).toBe(false);
    expect(itemIdSchema.safeParse('x'.repeat(33)).success).toBe(false);
  });

  it('accepts a section link or a safe url link, nothing else', () => {
    expect(linkTargetSchema.safeParse({ kind: 'section', sectionType: 'work' }).success).toBe(true);
    expect(linkTargetSchema.safeParse({ kind: 'url', url: 'https://x.test' }).success).toBe(true);
    expect(linkTargetSchema.safeParse({ kind: 'url', url: 'http://x.test' }).success).toBe(false);
    expect(linkTargetSchema.safeParse({ kind: 'other' }).success).toBe(false);
  });

  it('strips unknown keys (spec → Edge Cases)', () => {
    expect(metricSchema.parse({ value: '2+', label: 'Years', extra: 'x' })).toEqual({ value: '2+', label: 'Years' });
  });
});

describe('engine schemas', () => {
  it.each(['ghulam', 'abc', 'a-b-c', 'x1y2z3', 'a'.repeat(40)])('accepts the slug %s', (slug) => {
    expect(changeSlugRequestSchema.safeParse({ expectedRevision: 1, slug }).success).toBe(true);
  });

  it.each(['ab', 'a'.repeat(41), '-abc', 'abc-', 'a--b', 'ABC', 'a_b', 'a b'])('rejects the slug %j', (slug) => {
    expect(changeSlugRequestSchema.safeParse({ expectedRevision: 1, slug }).success).toBe(false);
  });

  it('rejects malformed section types in an order', () => {
    expect(reorderSectionsRequestSchema.safeParse({ expectedRevision: 0, order: ['About'] }).success).toBe(false);
    expect(reorderSectionsRequestSchema.safeParse({ expectedRevision: -1, order: [] }).success).toBe(false);
  });
});
