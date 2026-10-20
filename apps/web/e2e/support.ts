/**
 * Helpers for the browser journeys (`cms-panel-shell.T08`): reading the one-time codes the API
 * emailed (through the harness's local SMTP server) and signing in.
 */
import { expect, type Page } from '@playwright/test';

import { E2E_MAILBOX_PORT } from './support-constants.ts';

export { E2E_OWNER } from './support-constants.ts';

interface ReceivedMail {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
}

async function messagesTo(address: string): Promise<ReceivedMail[]> {
  const response = await fetch(`http://127.0.0.1:${String(E2E_MAILBOX_PORT)}/messages?to=${encodeURIComponent(address)}`);
  return (await response.json()) as ReceivedMail[];
}

/** How many messages `address` has received so far. */
export async function mailCount(address: string): Promise<number> {
  return (await messagesTo(address)).length;
}

/** The 6-digit code in the newest message to `address` after `after` messages, waiting for it. */
export async function nextCode(address: string, after: number): Promise<string> {
  let code: string | undefined;
  await expect
    .poll(
      async () => {
        const messages = await messagesTo(address);
        code = /\b(\d{6})\b/.exec(messages.at(-1)?.text ?? '')?.[1];
        return messages.length > after && code !== undefined;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
  return code ?? '';
}

/** A unique address for one test. */
export function uniqueEmail(prefix: string): string {
  return `${prefix}-${String(Date.now())}-${String(Math.floor(Math.random() * 1e6))}@portfolio.test`;
}

/** Signs in through the login screen and waits for the CMS. */
export async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/cms/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 30_000 });
}
