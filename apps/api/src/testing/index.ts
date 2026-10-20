/**
 * Shared test support for `apps/api`: the real-MongoDB and real-Redis harnesses, the fixture-factory base and
 * in-memory fakes of core ports. Imported by spec files only; excluded from the build.
 */
export { FixtureFactory } from './fixture-factory.js';
export { MongoTestHarness, type MongoTestHarnessOptions } from './mongo-test-harness.js';
export { RecordingLogger, type RecordedLogEntry } from './recording-logger.js';
export { RedisTestHarness, type RedisTestHarnessOptions } from './redis-test-harness.js';
export { AuthSessionFactory, NewUserFactory, OtpIssueFactory } from './auth/auth-fixtures.js';
export {
  InMemoryOAuthStateStore,
  InMemoryOtpReferenceStore,
  InMemorySessionStore,
  type Clock,
} from './auth/in-memory-stores.js';
export { InMemoryOtpRepository } from './auth/in-memory-otp-repository.js';
export { InMemoryUserRepository } from './auth/in-memory-user-repository.js';
export { RecordingMailSender } from './auth/recording-mail-sender.js';
export {
  FakeOtpHasher,
  FakePasswordHasher,
  ManualClock,
  SequenceSecureRandom,
} from './auth/test-doubles.js';
export {
  LOCAL_CLIENT_ID,
  LOCAL_CLIENT_SECRET,
  LocalOidcIssuer,
  type IssuedCode,
} from './auth/local-oidc-issuer.js';
export {
  InMemoryPortfolioRepository,
  InMemorySectionRepository,
} from './portfolio/in-memory-portfolio-repositories.js';
export {
  FakeHeroDefinition,
  FakeSectionDefinition,
  fakeSectionSchema,
  type FakeSection,
} from './portfolio/fake-section-definitions.js';
export {
  FIXTURE_HEADERS,
  fixtureFile,
  InMemoryAssetRepository,
  InMemoryFileStorage,
} from './assets/in-memory-assets.js';
export { InMemoryIdentityRepository } from './identity/in-memory-identity-repository.js';
export {
  cleanContent,
  REFERENCE_ORDER,
  SEED_PLACEHOLDER,
  sectionData,
  seedContent,
} from './publishing/publishing-fixtures.js';
