/**
 * The shared free-text schema helper (`int-standards.express.md` → Input validation;
 * `constitution.md` → Plain text only).
 *
 * Every free-text field the API stores — a display name, a section heading, a project
 * description — passes through `plainText(max)`: HTML tags and control characters are removed,
 * runs of whitespace inside a single-line value collapse, and the result is trimmed before the
 * length rules run. The stored value is therefore always plain text, and React renders it as a
 * string; nothing is ever interpreted as markup.
 *
 * Created by `account-registration.T01` for `displayName`; every section payload reuses it.
 */
import { z } from 'zod';

/** Anything shaped like an HTML tag or comment: `<b>`, `</p>`, `<img src=x>`, `<!-- … -->`. */
const TAG_PATTERN = /<!--[\s\S]*?-->|<\/?[a-zA-Z][^<>]*>/g;

/**
 * C0 and C1 control characters except tab, line feed and carriage return, plus the Unicode
 * bidirectional overrides that can make text render in a misleading order.
 */
// eslint-disable-next-line no-control-regex -- matching control characters is the point.
const CONTROL_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F‪-‮⁦-⁩]/g;

/** Options for `plainText`. */
export interface PlainTextOptions {
  /** Shortest accepted value after cleaning. Default 1, so an empty field is refused. */
  readonly min?: number;
  /**
   * Keep line breaks (a paragraph field). Default `false`: line breaks and tabs become single
   * spaces, as a heading or a name is one line.
   */
  readonly multiline?: boolean;
}

/**
 * Removes tags and control characters from `value`, normalises whitespace and trims it. Pure
 * and exported so the CMS can show a user exactly what will be stored.
 */
export function cleanPlainText(value: string, multiline = false): string {
  const stripped = value.replace(TAG_PATTERN, '').replace(CONTROL_PATTERN, '');
  const normalised = multiline
    ? stripped
        .replace(/\r\n?/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
    : stripped.replace(/\s+/g, ' ');
  return normalised.trim();
}

/**
 * A plain-text string of at most `max` characters after cleaning.
 *
 * @param max - Longest accepted value, counted after cleaning.
 */
export function plainText(max: number, { min = 1, multiline = false }: PlainTextOptions = {}) {
  return z
    .string()
    .transform((value) => cleanPlainText(value, multiline))
    .pipe(z.string().min(min).max(max));
}
