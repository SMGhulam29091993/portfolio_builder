/**
 * `IContentTypeDetector` from magic bytes (`media-assets.T03`; `constitution.md` → Uploads: MIME
 * is detected from the content, never from the extension or the client's header). Only the types
 * an asset kind can accept are recognised; everything else — SVG, HTML, executables — is
 * `undefined`, which no kind accepts.
 */
import type { IContentTypeDetector } from '../assets.interface.js';

/** The longest signature checked, so callers know how many bytes to read first. */
export const DETECTION_HEAD_BYTES = 12;

export class MagicByteContentTypeDetector implements IContentTypeDetector {
  detect(head: Buffer): string | undefined {
    if (startsWith(head, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
    if (startsWith(head, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
    if (startsWith(head, [0xff, 0xd8, 0xff])) return 'image/jpeg';
    // RIFF....WEBP
    if (startsWith(head, [0x52, 0x49, 0x46, 0x46]) && head.subarray(8, 12).toString('latin1') === 'WEBP') {
      return 'image/webp';
    }
    return undefined;
  }
}

function startsWith(head: Buffer, signature: readonly number[]): boolean {
  return head.length >= signature.length && signature.every((byte, index) => head[index] === byte);
}
