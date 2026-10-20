/**
 * The design screen in a real browser (`design-theme.T07`; E2E01, E2E02; AC10).
 */
import { expect, test } from '@playwright/test';

import { E2E_OWNER, signIn } from './support.ts';

test.beforeEach(async ({ page }) => {
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);
  await page.goto('/cms/design');
  await expect(page.getByRole('heading', { name: 'Design', level: 1 })).toBeVisible();
});

test('design-theme.E2E01 / AC10 — a failing contrast pair disables Save; restoring enables it', async ({ page }) => {
  const text = page.getByLabel('Text', { exact: true });
  await text.fill('#1a1a1a');

  await expect(page.locator('[data-contrast="fail"]').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

  await text.fill('#ededef');
  await expect(page.locator('[data-contrast="fail"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.getByLabel('Accent', { exact: true }).fill('#b4f02a');
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
});

test('design-theme.E2E02 / AC10 — change the accent and a layout, save, reload', async ({ page }) => {
  await page.getByLabel('Accent', { exact: true }).fill('#a3e635');
  await page.getByLabel('Hero').selectOption('centered');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Design saved.')).toBeVisible();
  await expect(page.locator('#design-form')).toHaveAttribute('data-dirty', 'false');

  await page.reload();
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('#a3e635');
  await expect(page.getByLabel('Hero')).toHaveValue('centered');
  const preview = page.locator('[data-theme-root]');
  await expect(preview).toHaveAttribute('style', /--color-accent:\s*#a3e635/);

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Reset to reference' }).click();
  await expect(page.getByLabel('Accent', { exact: true })).toHaveValue('#c0f83c');
});
