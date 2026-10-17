/**
 * Base class for test fixture factories (`.agent/workflows/generate-tests.md` step 5).
 *
 * Fixtures are built by factories, never copied from seed data, so editing the seed cannot
 * silently change what a test means. Each module's factory extends this class in
 * `src/testing/` and supplies `defaults()`; tests state only the fields they care about.
 *
 * Builds are deterministic: the n-th build of a factory always gets sequence number n, so ids and
 * unique values differ between fixtures but are identical between runs.
 *
 * @example
 * class ProjectFactory extends FixtureFactory<Project> {
 *   protected defaults(sequence: number): Project {
 *     return { slug: `project-${sequence}`, title: `Project ${sequence}` };
 *   }
 * }
 * const project = new ProjectFactory().build({ title: 'Second Brain' });
 */
export abstract class FixtureFactory<T extends object> {
  /** Number of fixtures built since construction or the last `resetSequence()`. */
  private sequence = 0;

  /**
   * A complete, valid fixture for build number `sequence` (starting at 1). Return a new object
   * on every call — never a shared constant — so tests cannot mutate each other's data.
   */
  protected abstract defaults(sequence: number): T;

  /** Builds one fixture; `overrides` replace top-level fields of the defaults. */
  build(overrides: Partial<T> = {}): T {
    this.sequence += 1;
    return { ...this.defaults(this.sequence), ...overrides };
  }

  /** Builds `count` fixtures, each with the same `overrides` and its own sequence number. */
  buildList(count: number, overrides: Partial<T> = {}): T[] {
    return Array.from({ length: count }, () => this.build(overrides));
  }

  /** Restarts numbering at 1, e.g. in `beforeEach`, when a test asserts on generated values. */
  resetSequence(): void {
    this.sequence = 0;
  }
}
