/**
 * `IStartupHook` — work that must finish after the container is built and before the server
 * listens (`constitution.md` → Infrastructure: "recover interrupted work … → listen"). The first
 * hook marks interrupted AI proposals failed (`ai-design-studio.AC10`).
 */
export interface IStartupHook {
  /** A short name for the startup log. */
  readonly name: string;
  /** A rejection fails startup, like an unreachable datastore. */
  run(): Promise<void>;
}
