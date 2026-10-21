/**
 * The assets screen in a real browser (`media-assets.T06`; E2E01, E2E02; AC11). Files are tiny
 * generated fixtures with valid headers, never real documents.
 */
import { expect, test } from '@playwright/test';

import { E2E_OWNER, signIn } from './support.ts';

const pdf = Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), Buffer.alloc(2_000, 0x20)]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d]);

test.beforeEach(async ({ page }) => {
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);
  await page.goto('/cms/assets');
  await expect(page.getByRole('heading', { name: 'Assets', level: 1 })).toBeVisible();
});

test('media-assets.E2E01 / AC11 — upload a PDF, see it listed, delete it', async ({ page }) => {
  await page.getByLabel('Upload résumé').setInputFiles({ name: 'e2e-cv.pdf', mimeType: 'application/pdf', buffer: pdf });

  // Scoped to the Files list: the confirmation toast is a list item naming the file too.
  const files = page.getByRole('region', { name: 'Files' });
  const row = files.getByRole('listitem').filter({ hasText: 'e2e-cv.pdf' });
  await expect(row).toBeVisible();
  await expect(page.getByText('Résumé uploaded.')).toBeVisible();

  page.once('dialog', (dialog) => void dialog.accept());
  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(row).toHaveCount(0);
});

test('media-assets.E2E02 / AC11 — too-large and wrong-type files explain the limit and the types', async ({ page }) => {
  const tooLarge = Buffer.concat([png, Buffer.alloc(2 * 1024 * 1024, 0)]);
  await page.getByLabel('Upload image').setInputFiles({ name: 'big.png', mimeType: 'image/png', buffer: tooLarge });
  await expect(page.getByText('That file is too large. The limit is 2 MB.')).toBeVisible();

  await page.getByLabel('Upload résumé').setInputFiles({ name: 'cv.pdf', mimeType: 'application/pdf', buffer: png });
  await expect(page.getByText('That file type is not accepted here. Upload PDF up to 5 MB.')).toBeVisible();
});
