/**
 * Shared test support for `apps/api`: the real-MongoDB harness, the fixture-factory base and
 * in-memory fakes of core ports. Imported by spec files only; excluded from the build.
 */
export { FixtureFactory } from './fixture-factory.js';
export { MongoTestHarness, type MongoTestHarnessOptions } from './mongo-test-harness.js';
export { RecordingLogger, type RecordedLogEntry } from './recording-logger.js';
