/**
 * The identity screen in a real browser (`site-identity.T07`; E2E01; AC10): upload a résumé,
 * choose it, save; the résumé select lists only résumé assets.
 */
import { expect, test } from '@playwright/test';

import { E2E_OWNER, signIn } from './support.ts';

const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), Buffer.from('identity e2e résumé', 'utf8')]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 1, 2, 3]);

test('site-identity.E2E01 / AC10 — choose an uploaded résumé and save', async ({ page }) => {
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);
  await page.goto('/cms/assets');
  await page.getByLabel('Upload résumé').setInputFiles({ name: 'identity-cv.pdf', mimeType: 'application/pdf', buffer: pdf });
  await expect(page.getByRole('region', { name: 'Files' }).getByText('identity-cv.pdf')).toBeVisible();
  await page.getByLabel('Upload image').setInputFiles({ name: 'identity-og.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByRole('region', { name: 'Files' }).getByText('identity-og.png')).toBeVisible();

  await page.getByRole('link', { name: 'Identity' }).first().click();
  await expect(page.getByRole('heading', { name: 'Identity', level: 1 })).toBeVisible();
  const resume = page.getByLabel('Résumé file');
  await expect(resume.locator('option')).toHaveText(['None', 'identity-cv.pdf']);
  await resume.selectOption({ label: 'identity-cv.pdf' });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Identity saved.')).toBeVisible();
  // Wait for the clean state: until it renders, the unsaved-changes guard would hold the reload.
  await expect(page.locator('#identity-form')).toHaveAttribute('data-dirty', 'false');

  await page.reload();
  await expect(page.getByLabel('Résumé file')).toHaveValue(/\w+/);
  await page.goto('/cms/assets');
  const row = page.getByRole('region', { name: 'Files' }).getByRole('listitem').filter({ hasText: 'identity-cv.pdf' });
  await expect(row.getByRole('button', { name: 'Delete' })).toBeDisabled();
});
