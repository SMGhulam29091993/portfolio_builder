/**
 * `DesignLibraryService` (`design-library.T03`; API01–API06; AC2, AC5, AC6, AC8): a portfolio's
 * custom layouts and named design presets. Layouts are validated with the one custom-layout
 * validator; preset designs with the design validator and the library check, through
 * `DesignService`, so a preset can never hold a design the editor would refuse. Nothing in use is
 * deleted: a layout the draft design or a preset names answers `LAYOUT_IN_USE`.
 */
import { validateCustomLayout } from '@portfolio/design-tokens';

import { ConflictError, NotFoundError, ValidationError, type ValidationIssue } from '../../core/errors/index.js';
import type { IClock } from '../auth/index.js';
import type {
  IDesignLibraryService,
  IDesignService,
  IDesignValidator,
  ILayoutLibraryRepository,
  IPresetRepository,
} from './design.interface.js';
import { LAYOUT_LIBRARY_MAX, PRESET_LIBRARY_MAX } from './design.types.js';
import type { CmsDesign, DesignPreset, DesignSpec, LibraryLayout, NewLayout, StoredLayout, StoredPreset } from './design.types.js';

/** The part of `DesignService` the library needs: reads, writes and the library check. */
type DesignAccess = Pick<IDesignService, 'read' | 'apply'> & { checkCustomLayouts(portfolioId: string, design: DesignSpec): Promise<void> };

export class DesignLibraryService implements IDesignLibraryService {
  constructor(
    private readonly layouts: ILayoutLibraryRepository,
    private readonly presets: IPresetRepository,
    private readonly designs: DesignAccess,
    private readonly validator: IDesignValidator,
    private readonly clock: IClock,
  ) {}

  async listLayouts(portfolioId: string): Promise<LibraryLayout[]> {
    return (await this.layouts.list(portfolioId)).map(toLibraryLayout);
  }

  async saveLayouts(
    portfolioId: string,
    candidates: readonly { name: string; layout: unknown; source: NewLayout['source'] }[],
  ): Promise<StoredLayout[]> {
    const issues: ValidationIssue[] = [];
    const layouts: NewLayout[] = [];
    candidates.forEach((candidate, index) => {
      const verdict = validateCustomLayout(candidate.layout);
      if (verdict.ok) layouts.push({ name: candidate.name, layout: verdict.layout, source: candidate.source });
      else issues.push(...verdict.issues.map((issue) => ({ path: `layouts.${String(index)}.${issue.path}`, message: issue.message })));
    });
    if (issues.length > 0) throw new ValidationError(issues);
    if ((await this.layouts.count(portfolioId)) + layouts.length > LAYOUT_LIBRARY_MAX) throw libraryFull(LAYOUT_LIBRARY_MAX);
    return this.layouts.insertMany(portfolioId, layouts, this.clock.now());
  }

  async deleteLayout(portfolioId: string, layoutId: string): Promise<void> {
    if ((await this.layouts.findLayout(portfolioId, layoutId)) === null) throw new NotFoundError('Layout not found');
    const ref = `custom:${layoutId}`;
    const usedBy: ('draft' | 'preset')[] = [];
    if (Object.values((await this.designs.read(portfolioId)).layout).includes(ref)) usedBy.push('draft');
    if (await this.presets.usesLayout(portfolioId, ref)) usedBy.push('preset');
    if (usedBy.length > 0) throw new ConflictError('LAYOUT_IN_USE', { usedBy }, 'This layout is in use; change the design or delete the preset first');
    await this.layouts.delete(portfolioId, layoutId);
  }

  async listPresets(portfolioId: string): Promise<DesignPreset[]> {
    return (await this.presets.list(portfolioId)).map(toPreset);
  }

  async savePreset(portfolioId: string, name: string, candidate: unknown): Promise<DesignPreset> {
    const design = this.validator.validate(candidate);
    await this.designs.checkCustomLayouts(portfolioId, design);
    if ((await this.presets.count(portfolioId)) >= PRESET_LIBRARY_MAX) throw libraryFull(PRESET_LIBRARY_MAX);
    return toPreset(await this.presets.insert(portfolioId, { name, design }, this.clock.now()));
  }

  async savePresetFromDraft(portfolioId: string, name: string): Promise<DesignPreset> {
    const { theme, layout } = await this.designs.read(portfolioId);
    return this.savePreset(portfolioId, name, { theme, layout });
  }

  async applyPreset(portfolioId: string, presetId: string, expectedRevision: number): Promise<CmsDesign> {
    const preset = await this.presets.find(portfolioId, presetId);
    if (!preset) throw new NotFoundError('Preset not found');
    return this.designs.apply(portfolioId, preset.design, expectedRevision);
  }

  async deletePreset(portfolioId: string, presetId: string): Promise<void> {
    if (!(await this.presets.delete(portfolioId, presetId))) throw new NotFoundError('Preset not found');
  }
}

function libraryFull(max: number): ConflictError {
  return new ConflictError('LIBRARY_FULL', { max }, `The library holds at most ${String(max)}; delete one first`);
}

function toLibraryLayout(layout: StoredLayout): LibraryLayout {
  return { id: layout.id, section: layout.section, name: layout.name, layout: layout.layout, source: layout.source, createdAt: layout.createdAt.toISOString() };
}

function toPreset(preset: StoredPreset): DesignPreset {
  return { id: preset.id, name: preset.name, design: preset.design, createdAt: preset.createdAt.toISOString() };
}
