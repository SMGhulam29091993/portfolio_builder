/** Asset screen text (`media-assets.AC11`). */
import { describe, expect, it } from 'vitest';

import { ApiError } from '../api/client';
import { formatBytes, kindRuleText, uploadErrorMessage } from './assets';

describe('asset screen text', () => {
  it('formats sizes', () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB');
    expect(formatBytes(540 * 1024)).toBe('540 KB');
    expect(formatBytes(12)).toBe('12 bytes');
  });

  it('states each kind rule from the contract limits', () => {
    expect(kindRuleText('resume')).toBe('PDF up to 5 MB');
    expect(kindRuleText('image')).toBe('PNG, JPEG, WebP up to 2 MB');
  });

  it('explains 413 with the limit and 415 with the allowed types', () => {
    expect(uploadErrorMessage(new ApiError(413, 'PAYLOAD_TOO_LARGE', { maxBytes: 2 * 1024 * 1024 }), 'image')).toBe(
      'That file is too large. The limit is 2 MB.',
    );
    expect(uploadErrorMessage(new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE'), 'resume')).toBe(
      'That file type is not accepted here. Upload PDF up to 5 MB.',
    );
  });
});
