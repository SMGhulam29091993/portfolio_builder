/**
 * Published-content fixtures for `publishing` tests: the owner's reference content in the order
 * the template uses, with or without the seed's one placeholder (`publish-pipeline.AC4`).
 */
import { DEFAULT_DESIGN } from '@portfolio/design-tokens';

import type { PublishedContent } from '../../modules/publishing/index.js';
import { REFERENCE_IDENTITY } from '../../seed/data/identity.js';
import { REFERENCE_SECTIONS } from '../../seed/data/sections/index.js';

/** The template's render order. */
export const REFERENCE_ORDER = ['hero', 'about', 'work', 'experience', 'stack', 'contact'] as const;

/** The seed's placeholder in the Second Brain description (`sections.work.projects[3].description`). */
export const SEED_PLACEHOLDER = '[ADD A ONE-LINE DESCRIPTION OF WHAT SECOND BRAIN DOES]';

/** The seed content exactly as seeded — one `no-placeholder-text` error. */
export function seedContent(): PublishedContent {
  return structuredClone({
    schemaVersion: 1,
    identity: REFERENCE_IDENTITY,
    sections: REFERENCE_ORDER.map((type) => ({ type, data: REFERENCE_SECTIONS[type] })),
    design: { theme: DEFAULT_DESIGN.theme, layout: { ...DEFAULT_DESIGN.layout } },
    assets: [],
  }) as PublishedContent;
}

/** The seed content with its placeholder replaced — publishable, with warnings only. */
export function cleanContent(): PublishedContent {
  const content = seedContent();
  return JSON.parse(JSON.stringify(content).replace(SEED_PLACEHOLDER, 'A second brain for notes.')) as PublishedContent;
}

/** A section's data from content, typed loosely for edits in tests. */
export function sectionData(content: PublishedContent, type: string): Record<string, unknown> {
  const section = content.sections.find((candidate) => candidate.type === type);
  if (!section) throw new Error(`No ${type} section in the fixture`);
  return section.data as Record<string, unknown>;
}

/** A résumé asset as a snapshot lists it. */
export const RESUME_ASSET = Object.freeze({
  id: 'resume-1',
  kind: 'resume' as const,
  filename: 'cv.pdf',
  mime: 'application/pdf',
  sizeBytes: 1_024,
  sha256: 'c'.repeat(64),
});

/** Clean content with a résumé — no issue from any of the nine rules. */
export function publishableContent(): PublishedContent {
  const content = cleanContent();
  content.identity.resume.assetId = RESUME_ASSET.id;
  content.assets = [{ ...RESUME_ASSET }];
  return content;
}
