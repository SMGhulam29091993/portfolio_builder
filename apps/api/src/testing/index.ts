/**
 * Shared test support for `apps/api`: the real-MongoDB and real-Redis harnesses, the fixture-factory base and
 * in-memory fakes of core ports. Imported by spec files only; excluded from the build.
 */
export { FixtureFactory } from './fixture-factory.js';
export { MongoTestHarness, type MongoTestHarnessOptions } from './mongo-test-harness.js';
export { RecordingLogger, type RecordedLogEntry } from './recording-logger.js';
export { RedisTestHarness, type RedisTestHarnessOptions } from './redis-test-harness.js';
export { AuthSessionFactory, NewUserFactory, OtpIssueFactory } from './auth/auth-fixtures.js';
export { InMemoryOtpReferenceStore, InMemorySessionStore, type Clock } from './auth/in-memory-stores.js';
export { InMemoryUserRepository } from './auth/in-memory-user-repository.js';
export {
  FakeOtpHasher,
  FakePasswordHasher,
  ManualClock,
  SequenceSecureRandom,
} from './auth/test-doubles.js';
