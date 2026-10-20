/**
 * Reads length and item limits from a contract schema (`cms-panel-shell.UT12`), so a counter
 * or an "Add" button uses exactly the limit the API enforces — never a second copy of the
 * number (`int-standards.nextjs.md` → Forms: client and server validation never diverge).
 */
import type { z } from 'zod';

export interface FieldLimits {
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
}

interface Introspectable {
  readonly _zod: { readonly def: Record<string, unknown> };
}

/** Steps through wrappers (optional, default, nullable, pipes) to the schema that holds limits. */
function unwrap(schema: unknown): Introspectable | undefined {
  let current = schema as Introspectable | undefined;
  for (let depth = 0; current && depth < 10; depth += 1) {
    const def = current._zod.def;
    if (def.type === 'optional' || def.type === 'default' || def.type === 'nullable') {
      current = def.innerType as Introspectable;
    } else if (def.type === 'pipe') {
      const out = def.out as Introspectable;
      // `plainText` pipes a transform into the bounded string: the limits are on `out`. A
      // transform-only pipe keeps them on `in`.
      current = out._zod.def.type === 'transform' ? (def.in as Introspectable) : out;
    } else {
      return current;
    }
  }
  return current;
}

/** The schema at a dot path (`items.0.title`, numeric segments step into arrays). */
export function schemaAt(schema: z.ZodType, path: string): unknown {
  let current: unknown = schema;
  for (const segment of path.split('.').filter(Boolean)) {
    const node = unwrap(current);
    if (!node) return undefined;
    const def = node._zod.def;
    if (def.type === 'object') current = (def.shape as Record<string, unknown>)[segment];
    else if (def.type === 'array') current = def.element;
    else return undefined;
  }
  return current;
}

/** The limits of the field at `path` (or of the schema itself when `path` is empty). */
export function fieldLimits(schema: z.ZodType, path = ''): FieldLimits {
  const node = unwrap(schemaAt(schema, path));
  if (!node) return {};
  const def = node._zod.def;
  if (def.type === 'string') {
    const bag = node as unknown as { minLength: number | null; maxLength: number | null };
    return {
      ...(bag.minLength === null ? {} : { minLength: bag.minLength }),
      ...(bag.maxLength === null ? {} : { maxLength: bag.maxLength }),
    };
  }
  if (def.type === 'array') {
    const limits: { minItems?: number; maxItems?: number } = {};
    for (const check of (def.checks as Introspectable[] | undefined) ?? []) {
      const checkDef = check._zod.def as { check?: string; maximum?: number; minimum?: number };
      if (checkDef.check === 'max_length' && checkDef.maximum !== undefined) limits.maxItems = checkDef.maximum;
      if (checkDef.check === 'min_length' && checkDef.minimum !== undefined) limits.minItems = checkDef.minimum;
    }
    return limits;
  }
  return {};
}
