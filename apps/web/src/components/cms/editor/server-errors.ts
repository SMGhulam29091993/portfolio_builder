/**
 * Maps a 400 `VALIDATION_FAILED` onto form fields (`cms-panel-shell.AC6`, `UT05`). The API's
 * paths are relative to the section's `data` (`section-engine` → Error Handling), which is
 * exactly the form's own shape, so each path names a form field as it is.
 */

export interface ServerIssue {
  readonly path: string;
  readonly message: string;
}

/** The issues in an `ApiError`'s data, or none. */
export function issuesOf(data: Readonly<Record<string, unknown>>): ServerIssue[] {
  const errors = data.errors;
  if (!Array.isArray(errors)) return [];
  return errors.flatMap((issue: unknown) => {
    if (typeof issue !== 'object' || issue === null) return [];
    const { path, message } = issue as { path?: unknown; message?: unknown };
    return typeof path === 'string' && typeof message === 'string' ? [{ path, message }] : [];
  });
}

/**
 * Sets each issue on its field and returns the first field's path (to focus), or `undefined`
 * when no issue names a field — the form then shows a general error instead.
 */
export function applyServerIssues(
  issues: readonly ServerIssue[],
  setError: (path: string, error: { type: string; message: string }) => void,
): string | undefined {
  let first: string | undefined;
  for (const { path, message } of issues) {
    if (!path) continue;
    setError(path, { type: 'server', message });
    first ??= path;
  }
  return first;
}
