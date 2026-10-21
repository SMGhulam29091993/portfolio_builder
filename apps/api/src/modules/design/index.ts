/** Public surface of the `design` module: interfaces and types only. */
export type {
  IDesignLibraryService,
  IDesignReader,
  IDesignRepository,
  IDesignValidator,
  IDesignWriter,
  ILayoutLibraryRepository,
  ILayoutLibraryWriter,
  ILayoutLookup,
  IPresetRepository,
  IPresetWriter,
} from './design.interface.js';
export type {
  CmsDesign,
  CustomLayout,
  DesignPreset,
  DesignSpec,
  LibraryLayout,
  NewLayout,
  StoredDesign,
  StoredLayout,
  StoredPreset,
} from './design.types.js';
