/**
 * AI-designed layouts, the layout library and presets in a real browser with the stub provider
 * (`design-library.T06`; E2E01, E2E02; AC9). The stub answers with a custom Work layout (featured
 * project beside the project list). Each journey resets the design, so other specs start from the
 * reference design.
 */
import { expect, test, type Page } from '@playwright/test';

import { E2E_OWNER, signIn } from './support.ts';

test.beforeEach(async ({ page }) => {
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);
});

async function resetDesign(page: Page): Promise<void> {
  await page.goto('/cms/design');
  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Reset to reference' }).click();
  await expect(page.getByLabel('Accent colour', { exact: true })).toHaveValue('#c0f83c');
}

test('design-library.E2E01 / AC9 — explore, preview the new layout, apply; it is in My layouts and the Work choice', async ({ page }) => {
  await page.goto('/cms/ai');
  await page.getByLabel('Describe the look you want').fill('Something new');
  await page.getByRole('switch', { name: 'Explore new layouts' }).check();
  await page.getByRole('button', { name: 'Generate proposal' }).click();
  await expect(page.locator('section[data-status="ready"]')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('New layouts for: work.')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Preview' }).locator('[data-custom-layout]')).toHaveCount(1);

  await page.getByRole('button', { name: 'Apply to draft' }).click();
  await expect(page.getByText('Proposal applied to your draft design.')).toBeVisible();

  await page.goto('/cms/design');
  const library = page.getByRole('region', { name: 'My layouts' });
  await expect(library.getByText('Something new · work')).toBeVisible();
  const workChoice = page.getByLabel('Work section layout');
  await expect(workChoice).toHaveValue(/^custom:[0-9a-f]{24}$/);
  await expect(workChoice.locator('option:checked')).toHaveText('My layout: Something new · work');

  // In use by the design: deleting it is refused with an explanation.
  await library.getByRole('button', { name: 'Delete layout Something new · work' }).click();
  await expect(page.getByText(/This layout is in use by your design/)).toBeVisible();

  await resetDesign(page);
  await page.getByRole('region', { name: 'My layouts' }).getByRole('button', { name: 'Delete layout Something new · work' }).first().click();
  await expect(page.getByText('Layout deleted.')).toBeVisible();
});

test('design-library.E2E02 / AC9 — save a preset, change the design, apply the preset', async ({ page }) => {
  await page.goto('/cms/design');
  await page.getByLabel('Accent colour', { exact: true }).fill('#a3e635');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Design saved.')).toBeVisible();

  const presets = page.getByRole('region', { name: 'Saved designs (presets)' });
  const name = `Lime ${String(Date.now())}`;
  await presets.getByLabel('Name for the current design').fill(name);
  await presets.getByRole('button', { name: 'Save as preset' }).click();
  await expect(presets.getByText(name)).toBeVisible();

  await resetDesign(page);
  await presets.getByRole('listitem').filter({ hasText: name }).getByRole('button', { name: 'Apply' }).click();
  await expect(page.getByText(`Applied "${name}".`)).toBeVisible();
  await expect(page.getByLabel('Accent colour', { exact: true })).toHaveValue('#a3e635');

  await presets.getByRole('button', { name: `Delete preset ${name}` }).click();
  await expect(page.getByText('Preset deleted.')).toBeVisible();
  await resetDesign(page);
});
