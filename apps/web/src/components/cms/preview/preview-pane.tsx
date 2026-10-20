'use client';
/**
 * The live preview (`cms-panel-shell.T07`; AC9): the saved draft with this section's unsaved
 * values applied (debounced 300 ms), rendered by `packages/sections` — the same components as
 * the public site — in the portfolio's design (`ThemeRoot`, its layout variants; the design
 * screen passes its unsaved design, `design-theme.AC10`), inside a 1440- or 390-wide frame scaled to fit the pane. Each section sits in
 * an error boundary. Below 1024 px the pane hides behind a toggle so the form stays usable.
 */
import { DEFAULT_DESIGN, type DesignSpec } from '@portfolio/design-tokens';
import { PortfolioPage, rendererRegistry, ThemeRoot } from '@portfolio/sections';
import { useEffect, useRef, useState } from 'react';

import { useDesign } from '../../../lib/api/design';
import { useIdentity } from '../../../lib/api/identity';
import { usePortfolioDraft, useSectionTypes } from '../../../lib/api/portfolio';
import { buildPreviewModel } from '../../../lib/cms/preview-model';
import { useCmsUi, type PreviewViewport } from '../../../lib/cms/ui-store';
import { Button } from '../ui';
import { SectionErrorBoundary } from './section-error-boundary';
import { useDebouncedValue } from './use-debounced-value';

/** The two reference widths (`design_reference.md`). */
export const VIEWPORT_WIDTHS: Readonly<Record<PreviewViewport, number>> = { desktop: 1440, mobile: 390 };

/** How long the preview waits after the last keystroke (AC9: within 300 ms). */
const PREVIEW_DEBOUNCE_MS = 250;

export function PreviewPane({ editing, design }: { editing?: { type: string; data: unknown }; design?: DesignSpec }) {
  const draft = usePortfolioDraft();
  const stored = useDesign();
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
  const [scale, setScale] = useState(1);
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

  if (!draft.data) return null;
  const model = buildPreviewModel(draft.data, debounced);
  const labels = new Map((types.data ?? []).map((info) => [info.type, info.label]));

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
      <div ref={frameHost} className={`${open ? 'block' : 'hidden'} overflow-hidden rounded-xl border border-neutral-800 xl:block`}>
        <div
          data-testid="preview-frame"
          data-viewport-width={width}
          style={{ width, transform: `scale(${String(scale)})`, transformOrigin: 'top left', height: `${String(100 / scale)}%` }}
        >
          <ThemeRoot theme={shown.theme}>
            <PortfolioPage
              sections={model.sections}
              sectionOrder={model.sectionOrder}
              registry={rendererRegistry}
              variants={shown.layout}
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
