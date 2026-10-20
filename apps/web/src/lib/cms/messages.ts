/**
 * User-facing CMS messages chosen by canonical error code, never by server message text
 * (`cms-panel-shell` → Error Handling). Pure, so every mapping is unit-tested
 * (`cms-panel-shell.UT11`).
 */
import { ApiError } from '../api/client';

/** Reasons `google-sign-in.API02` puts in `?error=` (`google-sign-in` → API02). */
const GOOGLE_MESSAGES: Readonly<Record<string, string>> = {
  google_unavailable: 'Google sign-in is not available right now.',
  google_cancelled: 'Google sign-in was cancelled.',
  google_state: 'That Google sign-in link expired or was already used. Please try again.',
  google_failed: 'Google sign-in did not complete. Please try again.',
  google_unverified: 'Google has not verified that email address, so it cannot be used to sign in.',
  google_conflict: 'That email address is linked to a different Google account.',
};

/** The message for a Google failure reason; a generic one for anything unknown (AC19). */
export function googleErrorMessage(reason: string): string {
  return GOOGLE_MESSAGES[reason] ?? 'Sign-in did not complete. Please try again.';
}

/** "1 minute 5 seconds" style wait text for a 429. */
export function formatWait(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts: string[] = [];
  if (minutes > 0) parts.push(`${String(minutes)} minute${minutes === 1 ? '' : 's'}`);
  if (rest > 0 || minutes === 0) parts.push(`${String(rest)} second${rest === 1 ? '' : 's'}`);
  return parts.join(' ');
}

/** A short message for errors any screen can meet. */
export function genericErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'The server could not be reached. Check your connection and try again.';
    case 'RATE_LIMITED':
      return `Too many attempts. Try again in ${formatWait(error.retryAfterSec ?? 60)}.`;
    case 'ORIGIN_NOT_ALLOWED':
      return 'This CMS is not served from the address the API expects. Contact the site administrator.';
    case 'SERVICE_UNAVAILABLE':
      return 'This service is temporarily unavailable. Please try again shortly.';
    case 'UPSTREAM_FAILED':
      return 'The email could not be sent. Please try again shortly.';
    case 'OTP_INVALID':
      return 'That code is not valid. Check it, or request a new one.';
    case 'OTP_EXPIRED':
      return 'That code has expired. Request a new one.';
    default:
      return error.status >= 500 ? 'Something went wrong on the server. Please try again.' : 'The request could not be completed.';
  }
}
