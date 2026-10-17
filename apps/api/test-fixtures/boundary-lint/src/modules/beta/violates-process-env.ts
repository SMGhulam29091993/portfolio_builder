/**
 * Fixture — AC9 (c): reads the environment outside `config/env.ts` in three forms.
 * Expected: `portfolio/no-process-env` × 3.
 */
import { env as nodeEnv } from 'node:process';

export const port = process.env.PORT;

const { env } = process;

export const mode = env.NODE_ENV ?? nodeEnv.NODE_ENV;
