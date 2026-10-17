// @ts-check
/**
 * Path helpers shared by the boundary rules.
 *
 * A file belongs to module `<name>` when its path contains `/src/modules/<name>/`
 * (`int-standards.express.md` → Per-module file pattern). Matching on that segment rather than on
 * an absolute root lets the same rules run on `apps/api/src` and on the lint fixtures that mirror it.
 */
import path from 'node:path';

/** The folder that makes a file part of a module; group 1 is the module name. */
const MODULE_SEGMENT = /\/src\/modules\/([^/]+)\//;

/** A module's public surface: `index.<ext>` directly inside its module folder. */
const MODULE_INDEX = /\/src\/modules\/[^/]+\/index\.[cm]?[jt]sx?$/;

/** @param {string} filePath */
function toPosix(filePath) {
  return filePath.split(path.sep).join('/');
}

/**
 * @param {string} filePath - Absolute path of a source file.
 * @returns {string | undefined} The module the file belongs to, or `undefined` outside `modules/`.
 */
export function moduleOf(filePath) {
  return MODULE_SEGMENT.exec(toPosix(filePath))?.[1];
}

/** @param {string} filePath - Absolute path; `true` for `src/modules/<name>/index.*` only. */
export function isModuleIndex(filePath) {
  return MODULE_INDEX.test(toPosix(filePath));
}

/**
 * Resolves a relative import specifier against the importing file. Bare specifiers (packages,
 * `node:` built-ins) return `undefined`: they cannot reach into a module.
 *
 * @param {string} fromFile - Absolute path of the importing file.
 * @param {string} specifier - The import specifier as written.
 */
export function resolveRelative(fromFile, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  return path.resolve(path.dirname(fromFile), specifier);
}
