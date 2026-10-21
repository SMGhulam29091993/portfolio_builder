/**
 * `DesignSpecParser` (`ai-design-studio.T03`; AC3, AC4, AC5; ADR-0006): a provider's raw text
 * becomes a usable design, or a list of reasons it cannot be used.
 *
 * In order:
 *   1. the first top-level JSON object is extracted (a Markdown fence or prose around it is
 *      ignored); none that parses → `INVALID_OUTPUT`;
 *   2. any string anywhere in it that holds markup or a URL → `INVALID_OUTPUT` — model output is
 *      data, never code, and nothing it writes is rendered or followed;
 *   3. the part outside the scope is replaced by the current design's (AC5);
 *   4. the result goes through `IDesignValidator`, the same verdict the design editor gets: extra
 *      keys are stripped, hex is normalised, and when the only problems are contrast pairs the
 *      code is `CONTRAST_FAILED`, carrying the measured ratios for the repair attempt (AC4).
 */
import { checkContrast, designSpecSchema, SECTION_TYPES, validateCustomLayout, type CustomLayout } from '@portfolio/design-tokens';
import { cleanPlainText } from '@portfolio/contracts';

import { AppError } from '../../core/errors/index.js';
import type { IDesignValidator } from '../design/index.js';
import type { IDesignSpecParser } from './ai-design.interface.js';
import {
  RATIONALE_MAX_LENGTH,
  type AnswerIssue,
  type DesignSpec,
  type ParsedAnswer,
  type ProposalScope,
} from './ai-design.types.js';

/** A tag or comment: `<div>`, `</p>`, `<!--`, `<?php`, `<svg/onload=…>`. */
const MARKUP_PATTERN = /<\s*[/!?]?\s*[a-z]/i;
/** A scheme a browser would follow or run, a `www.` host, or a protocol-relative host. */
const URL_PATTERN = /\b(?:https?|ftp|file|javascript|vbscript|data|mailto|blob):|\bwww\.|\/\/[a-z0-9-]+\.[a-z]/i;

export class DesignSpecParser implements IDesignSpecParser {
  constructor(private readonly validator: IDesignValidator) {}

  parse(text: string, scope: ProposalScope, current: DesignSpec): ParsedAnswer {
    const answer = this.extract(text);
    if (answer === undefined) return invalid([{ path: '', message: 'The answer has no JSON object' }]);

    const unsafe = this.unsafeStrings(answer, '');
    if (unsafe.length > 0) return invalid(unsafe);

    const rationale = answer.rationale;
    if (rationale !== undefined && rationale !== null && typeof rationale !== 'string') {
      return invalid([{ path: 'rationale', message: 'Must be a string' }]);
    }

    const candidate = {
      theme: scope === 'layout' ? current.theme : answer.theme,
      layout: scope === 'theme' ? current.layout : answer.layout,
    };
    // Custom layouts count only where the layout may change; each must pass the one validator for
    // its own section (`design-library.AC7`), or the answer goes to the repair attempt.
    const custom = scope === 'theme' ? { layouts: {}, issues: [] } : this.customLayouts(answer.customLayouts);
    try {
      const design = this.validator.validate(candidate);
      if (custom.issues.length > 0) return invalid(custom.issues);
      const cleaned = typeof rationale === 'string' ? cleanPlainText(rationale).slice(0, RATIONALE_MAX_LENGTH).trim() : '';
      const customLayouts = Object.keys(custom.layouts).length > 0 ? { customLayouts: custom.layouts } : {};
      return { ok: true, design: { ...design, ...customLayouts }, rationale: cleaned === '' ? null : cleaned };
    } catch (error) {
      if (!(error instanceof AppError) || error.code !== 'VALIDATION_FAILED') throw error;
      const issues = (error.details.errors ?? []) as readonly AnswerIssue[];
      return { ok: false, code: this.onlyContrast(candidate, issues) ? 'CONTRAST_FAILED' : 'INVALID_OUTPUT', issues };
    }
  }

  /** The answer's custom layouts by section, validated; `null` or absent entries mean none. */
  private customLayouts(value: unknown): { layouts: Partial<Record<CustomLayout['section'], CustomLayout>>; issues: AnswerIssue[] } {
    const layouts: Partial<Record<CustomLayout['section'], CustomLayout>> = {};
    const issues: AnswerIssue[] = [];
    if (value === undefined || value === null) return { layouts, issues };
    if (typeof value !== 'object' || Array.isArray(value)) return { layouts, issues: [{ path: 'customLayouts', message: 'Must be an object' }] };
    const entries = value as Record<string, unknown>;
    for (const section of SECTION_TYPES) {
      const candidate = entries[section];
      if (candidate === undefined || candidate === null) continue;
      const verdict = validateCustomLayout(candidate, section);
      if (verdict.ok) layouts[section] = verdict.layout;
      else issues.push(...verdict.issues.map((issue) => ({ path: join(`customLayouts.${section}`, issue.path), message: issue.message })));
    }
    return { layouts, issues };
  }

  /** The first balanced `{ … }` that parses to an object, scanning outside JSON strings. */
  private extract(text: string): Record<string, unknown> | undefined {
    for (let start = text.indexOf('{'); start !== -1; start = text.indexOf('{', start + 1)) {
      const end = this.matchingBrace(text, start);
      if (end === -1) return undefined;
      try {
        const value: unknown = JSON.parse(text.slice(start, end + 1));
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) return value as Record<string, unknown>;
      } catch {
        // Not JSON from this brace; try the next one.
      }
    }
    return undefined;
  }

  /** Index of the brace closing the one at `start`, or -1 when the text ends first. */
  private matchingBrace(text: string, start: number): number {
    let depth = 0;
    let inString = false;
    for (let index = start; index < text.length; index += 1) {
      const char = text[index];
      if (inString) {
        if (char === '\\') index += 1;
        else if (char === '"') inString = false;
      } else if (char === '"') inString = true;
      else if (char === '{') depth += 1;
      else if (char === '}') {
        depth -= 1;
        if (depth === 0) return index;
      }
    }
    return -1;
  }

  /** Every string, key included, that holds markup or a URL — in any field (AC3). */
  private unsafeStrings(value: unknown, path: string): AnswerIssue[] {
    if (typeof value === 'string') {
      if (MARKUP_PATTERN.test(value)) return [{ path, message: 'Markup is not allowed' }];
      if (URL_PATTERN.test(value)) return [{ path, message: 'Links and URLs are not allowed' }];
      return [];
    }
    if (Array.isArray(value)) return value.flatMap((item, index) => this.unsafeStrings(item, join(path, String(index))));
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).flatMap(([key, item]) => [
        ...this.unsafeStrings(key, join(path, '(key)')),
        ...this.unsafeStrings(item, join(path, key)),
      ]);
    }
    return [];
  }

  /** `true` when the candidate is well-formed and every issue is a failing contrast pair. */
  private onlyContrast(candidate: unknown, issues: readonly AnswerIssue[]): boolean {
    const shaped = designSpecSchema.safeParse(candidate);
    if (!shaped.success) return false;
    const failing = checkContrast(shaped.data.theme.colors).filter((result) => !result.passes).length;
    return failing > 0 && failing === issues.length;
  }
}

function invalid(issues: readonly AnswerIssue[]): ParsedAnswer {
  return { ok: false, code: 'INVALID_OUTPUT', issues };
}

function join(path: string, key: string): string {
  return path === '' ? key : `${path}.${key}`;
}
