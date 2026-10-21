/**
 * Plain-language text for the assets screen (`media-assets.AC11`), from the same limits the API
 * enforces (`ASSET_RULES`). Pure, so the explanations are unit-tested.
 */
import { ASSET_RULES, type AssetKind } from '@portfolio/contracts';

import { ApiError } from '../api/client';
import { genericErrorMessage } from './messages';

const TYPE_NAMES: Readonly<Record<string, string>> = {
  'application/pdf': 'PDF',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
  'image/webp': 'WebP',
};

/** `2 MB`, `5 MB`, `540 KB`. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${String(Math.round((bytes / (1024 * 1024)) * 10) / 10)} MB`;
  if (bytes >= 1024) return `${String(Math.round(bytes / 1024))} KB`;
  return `${String(bytes)} bytes`;
}

/** "PDF up to 5 MB" for a kind. */
export function kindRuleText(kind: AssetKind): string {
  const rules = ASSET_RULES[kind];
  return `${rules.mime.map((mime) => TYPE_NAMES[mime] ?? mime).join(', ')} up to ${formatBytes(rules.maxBytes)}`;
}

/** Why an upload failed, naming the limit or the allowed types. */
export function uploadErrorMessage(error: unknown, kind: AssetKind): string {
  if (error instanceof ApiError && error.code === 'PAYLOAD_TOO_LARGE') {
    const max = typeof error.data.maxBytes === 'number' ? error.data.maxBytes : ASSET_RULES[kind].maxBytes;
    return `That file is too large. The limit is ${formatBytes(max)}.`;
  }
  if (error instanceof ApiError && error.code === 'UNSUPPORTED_MEDIA_TYPE') {
    return `That file type is not accepted here. Upload ${kindRuleText(kind)}.`;
  }
  if (error instanceof ApiError && error.code === 'VALIDATION_FAILED') return 'That file is empty or could not be read.';
  return genericErrorMessage(error);
}
