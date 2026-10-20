'use client';
/**
 * `/cms/assets` (`media-assets.T06`; AC11): upload a résumé or an image with progress, see why a
 * file was refused (the limit, or the accepted types), the list of files, and Delete — disabled
 * with the reason while a file is in use.
 */
import { ASSET_KINDS, ASSET_RULES, type AssetKind, type AssetReference } from '@portfolio/contracts';
import { useId, useRef, useState } from 'react';

import { useAssets, useDeleteAsset, useUploadAsset } from '../../../lib/api/assets';
import { ApiError } from '../../../lib/api/client';
import { formatBytes, kindRuleText, uploadErrorMessage } from '../../../lib/cms/assets';
import { genericErrorMessage } from '../../../lib/cms/messages';
import { useCmsUi } from '../../../lib/cms/ui-store';
import { Button, Notice, focusRing } from '../ui';

const KIND_LABELS: Readonly<Record<AssetKind, string>> = { resume: 'Résumé', image: 'Image' };

export function AssetsScreen() {
  const assets = useAssets();
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Assets</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        {ASSET_KINDS.map((kind) => (
          <UploadControl key={kind} kind={kind} />
        ))}
      </div>
      <section aria-labelledby="files-heading" className="flex flex-col gap-3">
        <h2 id="files-heading" className="text-lg font-semibold">Files</h2>
        {assets.isPending ? <p role="status">Loading files…</p> : null}
        {assets.isError ? (
          <div className="flex flex-col gap-2">
            <Notice tone="error">{genericErrorMessage(assets.error)}</Notice>
            <Button variant="secondary" onClick={() => void assets.refetch()}>Retry</Button>
          </div>
        ) : null}
        {assets.data?.length === 0 ? <p className="text-sm text-neutral-400">No files yet.</p> : null}
        <ul className="flex flex-col gap-2">
          {assets.data?.map((asset) => <AssetRow key={asset.id} asset={asset} />)}
        </ul>
      </section>
    </div>
  );
}

function UploadControl({ kind }: { kind: AssetKind }) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadAsset();
  const notify = useCmsUi((state) => state.notify);
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const onPick = async (file: File | undefined) => {
    if (!file) return;
    setFailure(null);
    setProgress(0);
    try {
      await upload.mutateAsync({ kind, file, onProgress: setProgress });
      notify('success', `${KIND_LABELS[kind]} uploaded.`);
    } catch (error) {
      setFailure(uploadErrorMessage(error, kind));
    } finally {
      setProgress(null);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 rounded-2xl border border-neutral-800 p-4">
      <h2 id={`${id}-heading`} className="font-semibold">{KIND_LABELS[kind]}</h2>
      <p id={`${id}-rule`} className="text-sm text-neutral-400">{kindRuleText(kind)}</p>
      <label htmlFor={id} className="sr-only">Upload {KIND_LABELS[kind].toLowerCase()}</label>
      <input
        ref={input}
        id={id}
        type="file"
        accept={ASSET_RULES[kind].mime.join(',')}
        aria-describedby={`${id}-rule`}
        disabled={upload.isPending}
        onChange={(event) => void onPick(event.target.files?.[0])}
        className={`text-sm text-neutral-300 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-800 file:px-3 file:py-1.5 file:text-neutral-100 ${focusRing}`}
      />
      {progress !== null ? (
        <progress value={progress} max={1} aria-label={`Uploading ${KIND_LABELS[kind].toLowerCase()}`} className="w-full accent-lime-300" />
      ) : null}
      {failure ? <Notice tone="error">{failure}</Notice> : null}
    </section>
  );
}

function AssetRow({ asset }: { asset: AssetReference }) {
  const remove = useDeleteAsset();
  const notify = useCmsUi((state) => state.notify);
  const reasonId = useId();

  const onDelete = async () => {
    if (!window.confirm(`Delete ${asset.filename}?`)) return;
    try {
      await remove.mutateAsync(asset.id);
      notify('success', `${asset.filename} deleted.`);
    } catch (error) {
      notify(
        'error',
        error instanceof ApiError && error.code === 'ASSET_IN_USE'
          ? `${asset.filename} is in use and was not deleted.`
          : genericErrorMessage(error),
      );
    }
  };

  return (
    <li className="flex flex-wrap items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-950 px-4 py-3 text-sm">
      <a
        href={`/api/v1/cms/assets/${asset.id}/content`}
        target="_blank"
        rel="noreferrer"
        className={`min-w-40 flex-1 truncate font-medium underline underline-offset-4 ${focusRing}`}
      >
        {asset.filename}
      </a>
      <span className="text-neutral-400">{KIND_LABELS[asset.kind]}</span>
      <span className="text-neutral-400">{formatBytes(asset.sizeBytes)}</span>
      {asset.inUse ? (
        <span id={reasonId} className="text-xs text-neutral-300">
          In use — choose another file where it is used first
        </span>
      ) : null}
      <Button
        variant="danger"
        disabled={asset.inUse}
        aria-describedby={asset.inUse ? reasonId : undefined}
        busy={remove.isPending}
        onClick={() => void onDelete()}
      >
        Delete
      </Button>
    </li>
  );
}
