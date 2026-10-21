/**
 * The AI Studio in a real browser with the stub provider (`ai-design-studio.T10`; E2E01–E04;
 * AC16, AC18). The stub answers with its fixture: a light theme whose accent is `#3f6212` and the
 * alternate layouts. Journeys that apply a proposal reset the design afterwards, so other specs
 * still start from the reference design.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { E2E_OWNER, signIn } from './support.ts';

/** The stub fixture's accent (`apps/api/src/modules/ai-design/providers/stub.fixture.json`). */
const STUB_ACCENT = '#3f6212';

test.beforeEach(async ({ page }) => {
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);
  await page.goto('/cms/ai');
  await expect(page.getByRole('heading', { name: 'AI Studio', level: 1 })).toBeVisible();
});

/** Submits a prompt and waits for the proposal to be ready. */
async function propose(page: Page, prompt: string): Promise<void> {
  await page.getByLabel('Describe the look you want').fill(prompt);
  await page.getByRole('button', { name: 'Generate proposal' }).click();
  await expect(page.locator('section[data-status="ready"]')).toBeVisible({ timeout: 15_000 });
}

test('ai-design-studio.E2E04 / AC16, AC18 — the stub badge and the allowance show before anything is sent', async ({ page }) => {
  await expect(page.getByTestId('provider-badge')).toHaveText('Stub (development)');
  // The seeded account is the owner: unlimited.
  await expect(page.getByTestId('allowance')).toHaveText('Unlimited generations.');
});

test('ai-design-studio.E2E01 / AC16 — a ready proposal previews at both widths; the draft design is unchanged', async ({ page }) => {
  await page.goto('/cms/design');
  const accentBefore = await page.getByLabel('Accent colour', { exact: true }).inputValue();
  await page.goto('/cms/ai');

  await propose(page, 'Light and editorial');
  const preview = page.locator('[data-theme-root]');
  await expect(preview).toHaveAttribute('style', new RegExp(`--color-accent:\\s*${STUB_ACCENT}`));
  await page.getByRole('button', { name: 'Mobile' }).click();
  await expect(preview).toHaveAttribute('style', new RegExp(`--color-accent:\\s*${STUB_ACCENT}`));
  await page.getByRole('button', { name: 'Desktop' }).click();

  await page.goto('/cms/design');
  await expect(page.getByLabel('Accent colour', { exact: true })).toHaveValue(accentBefore);
});

test('ai-design-studio.E2E02 / AC16 — apply, then the design screen shows the applied tokens', async ({ page }) => {
  await propose(page, 'Warm and quiet');
  await page.getByRole('button', { name: 'Apply to draft' }).click();
  await expect(page.getByText('Proposal applied to your draft design.')).toBeVisible();

  await page.goto('/cms/design');
  await expect(page.getByLabel('Accent colour', { exact: true })).toHaveValue(STUB_ACCENT);
  await expect(page.getByLabel('Hero section layout')).toHaveValue('centered');

  page.once('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Reset to reference' }).click();
  await expect(page.getByLabel('Accent colour', { exact: true })).toHaveValue('#c0f83c');
});

test('ai-design-studio.E2E03 / AC16 — a discarded proposal leaves the history', async ({ page }) => {
  const prompt = `Discard me ${String(Date.now())}`;
  await propose(page, prompt);
  const history = page.getByRole('region', { name: 'History' });
  await expect(history.getByText(prompt)).toBeVisible();
  await page.getByRole('button', { name: 'Discard', exact: true }).click();
  await expect(page.getByText('Proposal discarded.')).toBeVisible();
  await expect(history.getByText(prompt)).toHaveCount(0);
});

test('ai-design-studio.E2E05 — with a ready proposal: no horizontal scroll at 390, 768, 1024, 1440; no serious axe violations', async ({ page }) => {
  await propose(page, 'Check the layout');
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByRole('heading', { name: 'AI Studio', level: 1 })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `scroll width at ${String(width)}`).toBeLessThanOrEqual(0);
  }
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.help}`);
  expect(serious).toEqual([]);
});
