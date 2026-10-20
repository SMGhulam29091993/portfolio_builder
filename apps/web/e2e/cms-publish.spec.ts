/**
 * The publish screen in a real browser (`publish-pipeline.T09`; E2E01–E2E03; AC19), against the
 * seeded development account, whose work section holds the one seed placeholder.
 */
import { expect, test, type Page } from '@playwright/test';

import { E2E_OWNER, signIn } from './support.ts';

test.describe.configure({ mode: 'serial' });

async function openPublish(page: Page): Promise<void> {
  await page.goto('/cms/publish');
  await expect(page.getByRole('heading', { name: 'Publish', level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Checks' })).toBeVisible();
  await expect(page.getByText('Checking the draft…')).toHaveCount(0);
}

/** Replaces the description of the work section's project at `index` and saves. */
async function editWorkDescription(page: Page, index: number, text: string): Promise<void> {
  await page.goto('/cms/sections/work');
  await expect(page.getByRole('heading', { name: 'Work', level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.getByLabel('Description', { exact: true }).nth(index).fill(text);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Work saved.')).toBeVisible();
}

async function publishWithNote(page: Page, note: string): Promise<void> {
  await openPublish(page);
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Publish this draft?' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Note (optional)').fill(note);
  await dialog.getByRole('button', { name: 'Publish now' }).click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);
});

test('publish-pipeline.E2E01 / AC19 — the seed placeholder is listed, links to the work editor, and blocks Publish', async ({ page }) => {
  await openPublish(page);
  await expect(page.getByText('Nothing is published yet.')).toBeVisible();
  await expect(page.getByTestId('publish-status')).toHaveText('Never published');
  await expect(page.getByRole('heading', { name: /^Must fix before publishing/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();

  await page.getByRole('link', { name: 'Fix: work › projects 4 › description' }).click();
  await expect(page).toHaveURL(/\/cms\/sections\/work$/);
});

test('publish-pipeline.E2E02 / AC19 — fix it and publish with a note: version 1 is live', async ({ page }) => {
  await editWorkDescription(page, 3, 'My own app, live at app.second-brain.live. A second brain for notes and links.');
  await publishWithNote(page, 'First version');

  const history = page.getByRole('list', { name: 'Published versions' });
  const first = history.getByRole('listitem').filter({ hasText: 'Version 1' });
  await expect(first.getByText('Live', { exact: true })).toBeVisible();
  await expect(first.getByText('First version')).toBeVisible();
  await expect(page.getByText(/^Version 1 is live, since /)).toBeVisible();
  await expect(page.getByText('The live site matches the draft.')).toBeVisible();
  // cms-panel-shell.AC11 — the header shows the live version and no badge.
  await expect(page.getByTestId('publish-status')).toHaveText(/^Version 1 live since /);
  await expect(page.getByText('Unpublished changes')).toHaveCount(0);
});

test('publish-pipeline.E2E03 / AC19 — publish again, then make version 1 live after confirming', async ({ page }) => {
  await editWorkDescription(page, 0, 'A second published description for the first project.');
  await publishWithNote(page, 'Second version');
  const history = page.getByRole('list', { name: 'Published versions' });
  await expect(history.getByRole('listitem').filter({ hasText: 'Version 2' }).getByText('Live', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Make version 1 live' }).click();
  const dialog = page.getByRole('dialog', { name: 'Make version 1 live?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Make live' }).click();

  await expect(history.getByRole('listitem').filter({ hasText: 'Version 1' }).getByText('Live', { exact: true })).toBeVisible();
  await expect(page.getByText('The draft has changes that are not published.')).toBeVisible();
  // cms-panel-shell.AC11 — the draft now differs from the live version 1.
  await expect(page.getByText('Unpublished changes')).toBeVisible();
});
