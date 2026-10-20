/**
 * Errors of the `publishing` module, mirroring `int-standards.express.md` → Error codes.
 */
import { AppError } from '../../core/errors/index.js';
import type { PublishIssue } from './publishing.types.js';

/** 422 `PUBLISH_BLOCKED` — at least one `error` issue (`publish-pipeline.API03`, AC4, AC5). */
export class PublishBlockedError extends AppError {
  readonly status = 422;

  constructor(issues: readonly PublishIssue[]) {
    super('PUBLISH_BLOCKED', 'Fix the listed problems before publishing', { issues });
  }
}
