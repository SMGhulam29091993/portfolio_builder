/**
 * Editing a section in a real browser (`cms-panel-shell` E2E05–E2E09, handed to the first section
 * spec; `about-section.T04`, AC8), against the seeded development account's reference content.
 */
import { expect, test, type Page } from '@playwright/test';

import { E2E_OWNER, signIn } from './support.ts';

async function openAbout(page: Page): Promise<void> {
  await page.goto('/cms/sections/about');
  await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible({ timeout: 30_000 });
}

test.beforeEach(async ({ page }) => {
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);
});

test('cms-panel-shell.E2E05 / AC5 — Save only when changed and valid; the saved value survives a reload', async ({ page }) => {
  await openAbout(page);
  const save = page.getByRole('button', { name: 'Save' });
  await expect(save).toBeDisabled();

  const text = page.getByLabel('What you are working on now', { exact: true });
  await text.fill('');
  await expect(save).toBeDisabled();
  await text.fill('Building portfolio tooling');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByText('About saved.')).toBeVisible();
  await expect(page.locator('#section-editor')).toHaveAttribute('data-dirty', 'false');

  await page.reload();
  await expect(page.getByLabel('What you are working on now', { exact: true })).toHaveValue('Building portfolio tooling');
});

test('cms-panel-shell.E2E06 / AC7 — a save from another page opens the conflict dialog', async ({ page, context }) => {
  await openAbout(page);
  const other = await context.newPage();
  await openAbout(other);

  await other.getByLabel('What you are working on now', { exact: true }).waitFor();
  await other.getByLabel('Card title', { exact: true }).first().fill('Now');
  await other.getByRole('button', { name: 'Save' }).click();
  await expect(other.getByText('About saved.')).toBeVisible();

  await page.getByLabel('Card title', { exact: true }).first().fill('Lately');
  await page.getByRole('button', { name: 'Save' }).click();
  const dialog = page.getByRole('dialog', { name: 'This section changed elsewhere' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Load latest' }).click();
  await expect(page.getByLabel('Card title', { exact: true }).first()).toHaveValue('Now');

  await page.getByLabel('Card title', { exact: true }).first().fill('Mine wins');
  await other.close();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('About saved.')).toBeVisible();
});

test('cms-panel-shell.E2E07 / AC8 — leaving with unsaved edits asks first; cancel keeps them', async ({ page }) => {
  await openAbout(page);
  await page.getByLabel('About you', { exact: true }).fill('An edit that is not saved yet.');

  page.once('dialog', (dialog) => void dialog.dismiss());
  await page.getByRole('navigation', { name: 'CMS' }).first().getByRole('link', { name: 'Overview' }).click();

  await expect(page).toHaveURL(/\/cms\/sections\/about$/);
  await expect(page.getByLabel('About you', { exact: true })).toHaveValue('An edit that is not saved yet.');
});

test('cms-panel-shell.E2E08 / AC9 — the preview follows typing and switches width', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await openAbout(page);
  const preview = page.getByRole('complementary', { name: 'Preview' });
  await expect(preview.getByRole('heading', { name: /Production backends/ })).toBeVisible();

  await page.getByLabel('Main text', { exact: true }).fill('Preview follows typing,');
  await expect(preview.getByRole('heading', { name: /Preview follows typing/ })).toBeVisible();

  await page.getByRole('button', { name: 'Mobile 390' }).click();
  await expect(page.getByTestId('preview-frame')).toHaveAttribute('data-viewport-width', '390');
});

test('cms-panel-shell.E2E09 / AC10 — hide a section and move one with the keyboard', async ({ page }) => {
  await page.goto('/cms');
  const sections = page.getByRole('region', { name: 'Sections' });
  const stackRow = sections.getByRole('listitem').filter({ hasText: 'Stack' });
  await stackRow.getByRole('switch').click();
  await expect(stackRow.getByText('Hidden')).toBeVisible();

  const moveUp = sections.getByRole('button', { name: 'Move Contact up' });
  await moveUp.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Order saved.')).toBeVisible();
  const labels = await sections.getByRole('listitem').allTextContents();
  expect(labels.findIndex((text) => text.startsWith('Contact'))).toBeLessThan(labels.findIndex((text) => text.startsWith('Stack')));

  await stackRow.getByRole('switch').click();
  await expect(stackRow.getByText('Hidden')).toHaveCount(0);
});

test('the editor says whether a section is on the site, and switching it keeps saving conflict-free', async ({ page }) => {
  await openAbout(page);
  await expect(page.locator('[data-visibility="shown"]')).toContainText('Shown on your site');
  await page.getByRole('button', { name: 'Hide from my site' }).click();
  await expect(page.locator('[data-visibility="hidden"]')).toContainText('Hidden: this section is not on your site');
  await page.getByRole('button', { name: 'Show on my site' }).click();
  await expect(page.locator('[data-visibility="shown"]')).toBeVisible();

  // The toggle bumped the revision; a save right after must not report a conflict.
  await page.getByLabel('About you', { exact: true }).fill('Saved straight after showing the section.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('About saved.')).toBeVisible();
});
