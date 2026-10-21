'use client';
/**
 * The live preview (`cms-panel-shell.T07`; AC9): the saved draft with this section's unsaved
 * values applied (debounced 300 ms), rendered by `packages/sections` — the same components as
 * the public site — in the portfolio's design (`ThemeRoot`, its layout variants; the design
 * screen passes its unsaved design, `design-theme.AC10`), inside a 1440- or 390-wide frame scaled to fit the pane. Each section sits in
 * an error boundary. Below 1024 px the pane hides behind a toggle so the form stays usable.
 */
import { DEFAULT_DESIGN, type CustomLayout, type DesignSpec } from '@portfolio/design-tokens';
import { PortfolioPage, rendererRegistry, ThemeRoot } from '@portfolio/sections';
import { useEffect, useRef, useState } from 'react';

import { resolveCustomLayouts, useDesign, useLayoutLibrary } from '../../../lib/api/design';
import { useIdentity } from '../../../lib/api/identity';
import { usePortfolioDraft, useSectionTypes } from '../../../lib/api/portfolio';
import { buildPreviewModel } from '../../../lib/cms/preview-model';
import { useCmsUi, type PreviewViewport } from '../../../lib/cms/ui-store';
import { Button, TextLink } from '../ui';
import { SectionErrorBoundary } from './section-error-boundary';
import { useDebouncedValue } from './use-debounced-value';

/** The two reference widths (`design_reference.md`). */
export const VIEWPORT_WIDTHS: Readonly<Record<PreviewViewport, number>> = { desktop: 1440, mobile: 390 };

/** How long the preview waits after the last keystroke (AC9: within 300 ms). */
const PREVIEW_DEBOUNCE_MS = 250;

export function PreviewPane({
  editing,
  design,
  customLayouts,
}: {
  editing?: { type: string; data: unknown };
  design?: DesignSpec;
  /** An AI proposal's own custom layouts, not yet in the library (`design-library.AC9`). */
  customLayouts?: Readonly<Partial<Record<string, CustomLayout>>>;
}) {
  const draft = usePortfolioDraft();
  const stored = useDesign();
  const library = useLayoutLibrary();
  const identity = useIdentity();
  // The design screen passes its unsaved design; every other screen previews the saved one.
  const shown = design ?? stored.data?.design ?? DEFAULT_DESIGN;
  const types = useSectionTypes();
  const viewport = useCmsUi((state) => state.viewport);
  const setViewport = useCmsUi((state) => state.setViewport);
  const open = useCmsUi((state) => state.previewOpen);
  const setOpen = useCmsUi((state) => state.setPreviewOpen);
  const debounced = useDebouncedValue(editing, PREVIEW_DEBOUNCE_MS);
  const frameHost = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  // The page's own height. A CSS transform does not change layout size, so the host is given
  // the scaled height explicitly; otherwise it keeps the unscaled height and shows an empty tail.
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  const width = VIEWPORT_WIDTHS[viewport];

  useEffect(() => {
    const host = frameHost.current;
    if (!host) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(Math.min(1, entry.contentRect.width / width));
    });
    observer.observe(host);
    return () => {
      observer.disconnect();
    };
  }, [width]);

  useEffect(() => {
    const page = frame.current;
    if (!page) return undefined;
    const observer = new ResizeObserver(() => {
      setContentHeight(page.offsetHeight);
    });
    observer.observe(page);
    return () => {
      observer.disconnect();
    };
  });

  if (!draft.data) return null;
  const model = buildPreviewModel(draft.data, debounced);
  // Library layouts the design names, then the proposal's own on top (`design-library.AC3`).
  const layouts = { ...resolveCustomLayouts(shown.layout, library.data), ...customLayouts };
  const labels = new Map((types.data ?? []).map((info) => [info.type, info.label]));
  const nothingVisible = model.sections.every((section) => !section.visible);

  return (
    <aside aria-label="Preview" className="flex min-w-0 flex-col gap-3 xl:w-[46%]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" className="xl:hidden" aria-expanded={open} onClick={() => { setOpen(!open); }}>
          {open ? 'Hide preview' : 'Show preview'}
        </Button>
        <div role="group" aria-label="Preview width" className="flex gap-1">
          {(['desktop', 'mobile'] as const).map((option) => (
            <Button
              key={option}
              variant={viewport === option ? 'primary' : 'ghost'}
              aria-pressed={viewport === option}
              onClick={() => { setViewport(option); }}
            >
              {option === 'desktop' ? 'Desktop 1440' : 'Mobile 390'}
            </Button>
          ))}
        </div>
      </div>
      {nothingVisible ? (
        <p role="status" className={`${open ? 'block' : 'hidden'} rounded-xl border border-neutral-800 p-4 text-sm text-neutral-300 xl:block`}>
          Nothing to preview yet: every section is hidden. Turn sections on from the{' '}
          <TextLink href="/cms">Overview</TextLink> page.
        </p>
      ) : null}
      <div
        ref={frameHost}
        className={`${open ? 'block' : 'hidden'} overflow-hidden rounded-xl border border-neutral-800 xl:block`}
        style={contentHeight === null ? undefined : { height: Math.ceil(contentHeight * scale) }}
      >
        <div
          ref={frame}
          data-testid="preview-frame"
          data-viewport-width={width}
          style={{ width, transform: `scale(${String(scale)})`, transformOrigin: 'top left' }}
        >
          <ThemeRoot theme={shown.theme}>
            <PortfolioPage
              sections={model.sections}
              sectionOrder={model.sectionOrder}
              registry={rendererRegistry}
              variants={shown.layout}
              customLayouts={layouts}
              context={{ identity: identity.data?.data ?? null }}
              wrapSection={(type, node) => (
                <SectionErrorBoundary label={labels.get(type) ?? type} resetKey={type === debounced?.type ? debounced.data : type}>
                  {node}
                </SectionErrorBoundary>
              )}
            />
          </ThemeRoot>
        </div>
      </div>
    </aside>
  );
}
