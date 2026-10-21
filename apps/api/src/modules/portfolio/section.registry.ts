/**
 * `ISectionRegistry` — the registered section types (`section-engine.T03`; ADR-0005; Strategy +
 * Registry). Built once by the container from the definition list; adding a type never edits
 * this class (`section-engine.AC10`).
 *
 * Construction is where a broken definition fails — at startup, never on a request
 * (`section-engine.AC11`; spec → Error Handling): a duplicate type, a malformed type id, or
 * defaults that do not satisfy the definition's own schema all throw `SectionRegistryError`
 * naming the type.
 */
import { sectionTypeSchema } from '@portfolio/contracts';

import type { ISectionDefinition, ISectionRegistry } from './portfolio.interface.js';

/** A definition list the engine cannot run with. */
export class SectionRegistryError extends Error {
  constructor(
    readonly type: string,
    reason: string,
  ) {
    super(`Section type "${type}": ${reason}`);
    this.name = 'SectionRegistryError';
  }
}

export class SectionRegistry implements ISectionRegistry {
  private readonly byType = new Map<string, ISectionDefinition>();

  constructor(definitions: readonly ISectionDefinition[]) {
    for (const definition of definitions) {
      const { type } = definition;
      if (!sectionTypeSchema.safeParse(type).success) {
        throw new SectionRegistryError(type, 'is not a valid type id');
      }
      if (this.byType.has(type)) throw new SectionRegistryError(type, 'is registered twice');
      if (!definition.schema.safeParse(definition.defaults()).success) {
        throw new SectionRegistryError(type, 'defaults do not satisfy its schema');
      }
      if (!definition.hideable && definition.orderable) {
        // Only `hero` is neither; a type that can move but not hide has no rule here.
        throw new SectionRegistryError(type, 'an orderable section must be hideable');
      }
      this.byType.set(type, definition);
    }
  }

  get(type: string): ISectionDefinition | undefined {
    return this.byType.get(type);
  }

  list(): readonly ISectionDefinition[] {
    return [...this.byType.values()];
  }
}
