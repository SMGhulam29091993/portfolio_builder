// Lints this package with its own baseline, which also proves the config loads.
import { createBaseConfig } from './base.js';

export default createBaseConfig({ tsconfigRootDir: import.meta.dirname });
