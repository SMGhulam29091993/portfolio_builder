/** `DesignService` with a fake repository (`design-theme.UT04`, `UT05`; AC1, AC2, AC5, AC6). */
import { DEFAULT_DESIGN, type DesignSpec } from '@portfolio/design-tokens';
import { beforeEach, describe, expect, it } from 'vitest';

import { ConflictError, ValidationError } from '../../core/errors/index.js';
import { InMemoryLayoutLibrary } from '../../testing/index.js';
import type { IDesignRepository } from './design.interface.js';
import { DesignService } from './design.service.js';
import type { StoredDesign } from './design.types.js';
import { DesignValidator } from './design.validator.js';

class FakeDesigns implements IDesignRepository {
  readonly stored = new Map<string, StoredDesign>();
  find(portfolioId: string): Promise<StoredDesign | null> {
    return Promise.resolve(this.stored.get(portfolioId) ?? null);
  }
  // eslint-disable-next-line @typescript-eslint/require-await -- async so conflicts reject.
  async create(portfolioId: string, design: DesignSpec): Promise<StoredDesign> {
    if (this.stored.has(portfolioId)) throw new ConflictError('DESIGN_EXISTS');
    const created = { portfolioId, revision: 1, design, updatedAt: new Date() };
    this.stored.set(portfolioId, created);
    return created;
  }
  update(portfolioId: string, expectedRevision: number, design: DesignSpec): Promise<StoredDesign | null> {
    const current = this.stored.get(portfolioId);
    if (current?.revision !== expectedRevision) return Promise.resolve(null);
    const updated = { ...current, revision: current.revision + 1, design };
    this.stored.set(portfolioId, updated);
    return Promise.resolve(updated);
  }
}

const clone = (): DesignSpec => structuredClone(DEFAULT_DESIGN);
let designs: FakeDesigns;
let service: DesignService;

beforeEach(() => {
  designs = new FakeDesigns();
  service = new DesignService(designs, new DesignValidator(), new InMemoryLayoutLibrary());
});

describe('DesignService', () => {
  it('design-theme.AC1 — the default at revision 0 until a save', async () => {
    await expect(service.read('p1')).resolves.toEqual({ ...DEFAULT_DESIGN, revision: 0 });
  });

  it('design-theme.UT04 / AC2, AC5 — create at 0, update, then stale is REVISION_CONFLICT', async () => {
    const accent = clone();
    accent.theme.colors.accent = '#d4ff5a';

    await expect(service.apply('p1', clone(), 0)).resolves.toMatchObject({ revision: 1 });
    await expect(service.apply('p1', accent, 1)).resolves.toMatchObject({ revision: 2, theme: { colors: { accent: '#d4ff5a' } } });
    await expect(service.apply('p1', clone(), 1)).rejects.toMatchObject({ code: 'REVISION_CONFLICT', details: { currentRevision: 2 } });
    await expect(service.reset('p1', 1)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
    await expect(service.apply('p1', clone(), 0)).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  });

  it('design-theme.UT05 / AC6 — reset stores the package default', async () => {
    const edited = clone();
    edited.layout.hero = 'centered';
    await service.apply('p1', edited, 0);

    await service.reset('p1', 1);

    expect(designs.stored.get('p1')?.design).toEqual(DEFAULT_DESIGN);
  });

  it('rejects an invalid design with every issue and writes nothing', async () => {
    const bad = clone();
    bad.theme.colors.text = '#0a0a0a';
    bad.layout.work = 'nope';

    const error = await service.apply('p1', bad, 0).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationError);
    expect(((error as ValidationError).details.errors as { path: string }[]).map((issue) => issue.path)).toContain('layout.work');
    expect(designs.stored.size).toBe(0);
  });

  it('reports revision 0 as current when an update finds no design at all', async () => {
    await expect(service.apply('missing', clone(), 3)).rejects.toMatchObject({ code: 'REVISION_CONFLICT', details: { currentRevision: 0 } });
  });

  it('passes on a create failure that is not a duplicate', async () => {
    designs.create = () => Promise.reject(new Error('db down'));

    await expect(service.apply('p1', clone(), 0)).rejects.toThrow('db down');
  });
});
