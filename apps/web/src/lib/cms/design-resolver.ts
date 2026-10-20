/**
 * A react-hook-form resolver over `validateDesign` (`design-theme.AC10`, `AC11`): the CMS
 * validates with the exact function the API's `DesignValidator` calls, so a design the form
 * accepts is one the API accepts, contrast included. Every issue lands on its field path.
 */
import { validateDesign, type DesignSpec } from '@portfolio/design-tokens';
import type { FieldErrors, Resolver } from 'react-hook-form';

export const designResolver: Resolver<DesignSpec> = (values) => {
  const verdict = validateDesign(values);
  if (verdict.ok) return { values: verdict.design, errors: {} };
  const errors: Record<string, unknown> = {};
  for (const issue of verdict.issues) {
    const segments = issue.path.split('.');
    let node = errors;
    segments.forEach((segment, index) => {
      if (index === segments.length - 1) {
        node[segment] ??= { type: 'validate', message: issue.message };
      } else {
        node[segment] ??= {};
        node = node[segment] as Record<string, unknown>;
      }
    });
  }
  return { values: {}, errors: errors as FieldErrors<DesignSpec> };
};
