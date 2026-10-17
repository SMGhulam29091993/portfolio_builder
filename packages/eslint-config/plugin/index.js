// @ts-check
/**
 * The `portfolio` ESLint plugin: the four architecture rules of `monorepo-foundation.AC9`, each
 * with its own id so a failure names the boundary it broke. Enabled for `apps/api` by `../api.js`.
 *
 * | Rule | Enforces (`constitution.md` → Architectural Constraints) |
 * |---|---|
 * | `module-boundary` | (a) other modules are imported through `modules/<name>/index.ts` only |
 * | `no-framework-in-service` | (b) a service imports neither `mongoose` nor `express` |
 * | `no-process-env` | (c) only `config/env.ts` reads `process.env` |
 * | `no-instantiation-outside-container` | (d) wired classes are created in `container.ts` only |
 *
 * Module-level edges between modules are checked by the API's architecture test, not by lint.
 */
import moduleBoundary from './rules/module-boundary.js';
import noFrameworkInService from './rules/no-framework-in-service.js';
import noInstantiationOutsideContainer from './rules/no-instantiation-outside-container.js';
import noProcessEnv from './rules/no-process-env.js';

/** @type {import('eslint').ESLint.Plugin} */
const plugin = {
  meta: { name: '@portfolio/eslint-config/plugin', namespace: 'portfolio' },
  rules: {
    'module-boundary': moduleBoundary,
    'no-framework-in-service': noFrameworkInService,
    'no-process-env': noProcessEnv,
    'no-instantiation-outside-container': noInstantiationOutsideContainer,
  },
};

export default plugin;
