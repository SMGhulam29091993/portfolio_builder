'use client';
/**
 * Gives form-kit fields the contract schema of the form they are in, so each field reads its
 * own limits (`lib/cms/schema-limits.ts`) without the editor passing numbers around.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { z } from 'zod';

import { fieldLimits, type FieldLimits } from '../../../lib/cms/schema-limits';

const FormSchemaContext = createContext<z.ZodType | null>(null);

export function FormSchemaProvider({ schema, children }: { schema: z.ZodType; children: ReactNode }) {
  return <FormSchemaContext.Provider value={schema}>{children}</FormSchemaContext.Provider>;
}

/** The limits of the field at `name` in the surrounding form's schema; none outside one. */
export function useFieldLimits(name: string): FieldLimits {
  const schema = useContext(FormSchemaContext);
  return schema ? fieldLimits(schema, name) : {};
}
