/**
 * Published content → what the current renderers take (`public-site-rendering.T08`; AC16,
 * UT07) — Adapter, keyed by `schemaVersion`. A rolled-back snapshot may be older than the
 * current shape; each supported version has an adapter, so old versions keep rendering. A
 * version newer than this build knows is refused rather than guessed at.
 */
import { identitySchema, type PublishedContent } from '@portfolio/contracts';
import { DEFAULT_DESIGN, themeTokensSchema, type ThemeTokens } from '@portfolio/design-tokens';

/** Published content as the page renders it: the theme parsed, the layout as stored. */
export interface RenderableContent {
  readonly identity: PublishedContent['identity'];
  readonly sections: PublishedContent['sections'];
  readonly theme: ThemeTokens;
  readonly layout: Readonly<Record<string, string>>;
  readonly assets: PublishedContent['assets'];
}

export class UnsupportedSnapshotVersionError extends Error {
  constructor(readonly version: unknown) {
    super(`Unsupported snapshot schemaVersion: ${String(version)}`);
    this.name = 'UnsupportedSnapshotVersionError';
  }
}

type Adapter = (content: Record<string, unknown>) => RenderableContent;

/** Version 1 is the current shape (`publish-pipeline` → Published content). */
function adaptVersion1(content: Record<string, unknown>): RenderableContent {
  const design = (content.design ?? {}) as { theme?: unknown; layout?: Record<string, string> };
  const theme = themeTokensSchema.safeParse(design.theme);
  return {
    identity: identitySchema.parse(content.identity),
    sections: (content.sections ?? []) as PublishedContent['sections'],
    // A theme this build cannot read renders in the default rather than failing the page; a
    // layout variant no longer in the catalogue falls back to the reference renderer.
    theme: theme.success ? theme.data : DEFAULT_DESIGN.theme,
    layout: design.layout ?? {},
    assets: (content.assets ?? []) as PublishedContent['assets'],
  };
}

const ADAPTERS: Readonly<Record<number, Adapter>> = { 1: adaptVersion1 };

/** @throws {UnsupportedSnapshotVersionError} The version has no adapter (a newer build wrote it). */
export function adaptSnapshot(content: unknown): RenderableContent {
  const record = (typeof content === 'object' && content !== null ? content : {}) as Record<string, unknown>;
  const version = record.schemaVersion;
  const adapter = typeof version === 'number' ? ADAPTERS[version] : undefined;
  if (!adapter) throw new UnsupportedSnapshotVersionError(version);
  return adapter(record);
}
