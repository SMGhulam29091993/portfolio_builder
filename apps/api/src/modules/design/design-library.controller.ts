/** HTTP in/out for the design library (`design-library.T03`; API01–API06). */
import type { Request, RequestHandler } from 'express';

import { UnauthenticatedError } from '../../core/errors/index.js';
import { created, ok } from '../../core/http/index.js';
import type { IDesignLibraryService } from './design.interface.js';
import type { ApplyPresetRequest, SavePresetRequest } from './design.types.js';

export class DesignLibraryController {
  constructor(private readonly library: IDesignLibraryService) {}

  /** `GET /api/v1/cms/design/layouts` — `design-library.API01`. */
  readonly listLayouts: RequestHandler = async (req, res) => {
    ok(res, 'Layouts', { layouts: await this.library.listLayouts(portfolioIdOf(req)) });
  };

  /** `DELETE /api/v1/cms/design/layouts/:id` — `design-library.API02`. */
  readonly deleteLayout: RequestHandler = async (req, res) => {
    await this.library.deleteLayout(portfolioIdOf(req), idOf(req));
    ok(res, 'Layout deleted', { deleted: true });
  };

  /** `GET /api/v1/cms/design/presets` — `design-library.API03`. */
  readonly listPresets: RequestHandler = async (req, res) => {
    ok(res, 'Presets', { presets: await this.library.listPresets(portfolioIdOf(req)) });
  };

  /** `POST /api/v1/cms/design/presets` — `design-library.API04`. */
  readonly savePreset: RequestHandler = async (req, res) => {
    const { name } = req.validatedBody as SavePresetRequest;
    created(res, 'Preset saved', { preset: await this.library.savePresetFromDraft(portfolioIdOf(req), name) });
  };

  /** `POST /api/v1/cms/design/presets/:id/apply` — `design-library.API05`. */
  readonly applyPreset: RequestHandler = async (req, res) => {
    const { expectedRevision } = req.validatedBody as ApplyPresetRequest;
    ok(res, 'Preset applied', { design: await this.library.applyPreset(portfolioIdOf(req), idOf(req), expectedRevision) });
  };

  /** `DELETE /api/v1/cms/design/presets/:id` — `design-library.API06`. */
  readonly deletePreset: RequestHandler = async (req, res) => {
    await this.library.deletePreset(portfolioIdOf(req), idOf(req));
    ok(res, 'Preset deleted', { deleted: true });
  };
}

function portfolioIdOf(req: Request): string {
  if (!req.portfolio) throw new UnauthenticatedError();
  return req.portfolio.portfolioId;
}

function idOf(req: Request): string {
  return (req.validatedParams as { id: string }).id;
}
