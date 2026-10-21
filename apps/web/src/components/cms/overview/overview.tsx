'use client';
/**
 * The CMS overview (`cms-panel-shell.T06`; AC10, AC20): the portfolio address, then every
 * section in page order with its visibility switch and reorder controls. `hero` shows neither
 * — it is always first and always visible. Reorder works by dragging a row or with Move up /
 * Move down; each change is one `section-engine.API05` call with the portfolio revision.
 */
import type { CmsSection, SectionTypeInfo } from '@portfolio/contracts';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ApiError } from '../../../lib/api/client';
import {
  portfolioKeys,
  usePortfolioDraft,
  useReorderSections,
  useSectionTypes,
  useSetVisibility,
} from '../../../lib/api/portfolio';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { moveBy, moveTo } from '../../../lib/cms/order';
import { useCmsUi } from '../../../lib/cms/ui-store';
import { GuardedLink } from '../panel/guarded-link';
import { Button, Notice, focusRing } from '../ui';
import { AddressCard } from './address-card';

export function Overview() {
  const draft = usePortfolioDraft();
  const types = useSectionTypes();

  if (draft.isPending || types.isPending) return <p role="status">Loading your portfolio…</p>;
  if (draft.isError || types.isError) {
    return (
      <div className="flex max-w-md flex-col gap-3">
        <Notice tone="error">{genericErrorMessage(draft.error ?? types.error)}</Notice>
        <Button
          onClick={() => {
            void draft.refetch();
            void types.refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <AddressCard slug={draft.data.portfolio.slug} revision={draft.data.portfolio.revision} />
      <SectionList
        sections={draft.data.sections}
        types={types.data}
        order={draft.data.portfolio.sectionOrder}
        revision={draft.data.portfolio.revision}
      />
    </div>
  );
}

function SectionList({
  sections,
  types,
  order,
  revision,
}: {
  sections: readonly CmsSection[];
  types: readonly SectionTypeInfo[];
  order: readonly string[];
  revision: number;
}) {
  const queryClient = useQueryClient();
  const reorder = useReorderSections();
  const setVisibility = useSetVisibility();
  const notify = useCmsUi((state) => state.notify);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const byType = new Map(sections.map((section) => [section.type, section]));
  const info = new Map(types.map((entry) => [entry.type, entry]));
  const fixed = types.filter((entry) => !entry.orderable).map((entry) => entry.type);

  const onError = async (error: unknown) => {
    if (error instanceof ApiError && error.code === 'REVISION_CONFLICT') {
      await queryClient.invalidateQueries({ queryKey: portfolioKeys.draft });
      notify('error', 'Your portfolio changed elsewhere; the list now shows the latest version.');
    } else {
      notify('error', genericErrorMessage(error));
    }
  };

  const saveOrder = async (next: string[]) => {
    if (next.join() === order.join()) return;
    try {
      await reorder.mutateAsync({ expectedRevision: revision, order: next });
      notify('success', 'Order saved.');
    } catch (error) {
      await onError(error);
    }
  };

  const toggle = async (section: CmsSection) => {
    try {
      await setVisibility.mutateAsync({ type: section.type, expectedRevision: section.revision, visible: !section.visible });
    } catch (error) {
      await onError(error);
    }
  };

  const row = (type: string, index: number | null) => {
    const section = byType.get(type);
    const entry = info.get(type);
    if (!section || !entry) return null;
    const label = entry.label;
    return (
      <li
        key={type}
        draggable={index !== null}
        onDragStart={() => {
          setDragFrom(index);
        }}
        onDragOver={(event) => {
          if (index !== null) event.preventDefault();
        }}
        onDrop={() => {
          if (dragFrom !== null && index !== null && dragFrom !== index) void saveOrder(moveTo(order, dragFrom, index));
          setDragFrom(null);
        }}
        className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3"
      >
        <GuardedLink href={`/cms/sections/${type}`} className="min-w-32 flex-1 rounded font-medium hover:text-lime-300">
          {label}
        </GuardedLink>
        {!section.visible ? <span className="text-xs uppercase tracking-widest text-neutral-400">Hidden</span> : null}
        {entry.hideable ? (
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input
              type="checkbox"
              role="switch"
              checked={section.visible}
              disabled={setVisibility.isPending}
              onChange={() => void toggle(section)}
              className={`h-5 w-9 accent-lime-300 ${focusRing}`}
            />
            <span>Visible</span>
          </label>
        ) : null}
        {index !== null ? (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              disabled={index === 0 || reorder.isPending}
              aria-label={`Move ${label} up`}
              onClick={() => void saveOrder(moveBy(order, type, -1))}
            >
              ↑
            </Button>
            <Button
              variant="ghost"
              disabled={index === order.length - 1 || reorder.isPending}
              aria-label={`Move ${label} down`}
              onClick={() => void saveOrder(moveBy(order, type, 1))}
            >
              ↓
            </Button>
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <section aria-labelledby="sections-heading" className="flex flex-col gap-4">
      <h2 id="sections-heading" className="text-lg font-semibold">Sections</h2>
      <p className="text-sm text-neutral-400">Drag a section, or use its arrows, to change the page order.</p>
      <ol className="flex flex-col gap-2">
        {fixed.map((type) => row(type, null))}
        {order.map((type, index) => row(type, index))}
      </ol>
    </section>
  );
}
