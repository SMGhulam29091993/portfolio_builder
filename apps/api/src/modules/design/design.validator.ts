/**
 * `IDesignValidator` (`design-theme.T03`; AC3, AC4, AC11): `validateDesign` from
 * `packages/design-tokens` — the same function the CMS's live checks call — turned into a
 * `ValidationError` carrying every issue.
 */
import { validateDesign } from '@portfolio/design-tokens';

import { ValidationError } from '../../core/errors/index.js';
import type { IDesignValidator } from './design.interface.js';
import type { DesignSpec } from './design.types.js';

export class DesignValidator implements IDesignValidator {
  validate(candidate: unknown): DesignSpec {
    const verdict = validateDesign(candidate);
    if (!verdict.ok) throw new ValidationError(verdict.issues);
    return verdict.design;
  }
}
