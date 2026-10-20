/**
 * "Continue with Google" (`cms-panel-shell.AC19`): a plain link to `google-sign-in.API01`, which
 * redirects to Google. Shown only when the registration options say Google is configured.
 */
import { ButtonLink } from './ui';

export const GOOGLE_START_PATH = '/api/v1/auth/google/start';

export function GoogleButton() {
  return <ButtonLink href={GOOGLE_START_PATH}>Continue with Google</ButtonLink>;
}
