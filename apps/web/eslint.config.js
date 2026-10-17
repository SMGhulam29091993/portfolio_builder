// Shared baseline only: the `portfolio/*` boundary rules describe the API's module layout.
import { createBaseConfig } from '@portfolio/eslint-config/base';

export default createBaseConfig({ tsconfigRootDir: import.meta.dirname });
