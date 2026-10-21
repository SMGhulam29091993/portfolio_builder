/**
 * CMS sign-in, registration and password-reset journeys in a real browser against the real API
 * (`cms-panel-shell.T08`; E2E01–E2E03, E2E10–E2E12, E2E14, E2E15 and the registration journey;
 * AC1–AC3, AC12, AC14–AC17; `cms-panel-shell.T09`, E2E16 / AC21). Codes are read from the harness's local SMTP server.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { E2E_OWNER, mailCount, nextCode, signIn, uniqueEmail } from './support.ts';

const NEW_PASSWORD = 'a fresh e2e password 01';

/** Registers through the screen and verifies with the emailed code; ends on the overview. */
async function registerAndVerify(page: Page, email: string, displayName: string): Promise<void> {
  const before = await mailCount(email);
  await page.goto('/cms/register');
  await page.getByLabel('Display name').fill(displayName);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(NEW_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await page.getByLabel('Verification code').fill(await nextCode(email, before));
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 30_000 });
}

/** Serious and critical axe violations on the current page (AC14). */
async function seriousViolations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations
    .filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
    .map((violation) => `${violation.id}: ${violation.help}`);
}

test('cms-panel-shell.E2E01 / AC1 — a signed-out deep link goes to sign-in and back after it', async ({ page }) => {
  await page.goto('/cms/sections/about');
  await expect(page).toHaveURL(/\/cms\/login\?next=%2Fcms%2Fsections%2Fabout/, { timeout: 30_000 });

  await page.getByLabel('Email').fill(E2E_OWNER.email);
  await page.getByLabel('Password').fill(E2E_OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/cms\/sections\/about$/, { timeout: 30_000 });
});

test('cms-panel-shell.E2E02 / AC1 — an off-site next is ignored', async ({ page }) => {
  await page.goto('/cms/login?next=https%3A%2F%2Fevil.example');
  await page.getByLabel('Email').fill(E2E_OWNER.email);
  await page.getByLabel('Password').fill(E2E_OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page).toHaveURL(/\/cms$/, { timeout: 30_000 });
});

test('cms-panel-shell.E2E03 / AC2 — a wrong password shows one generic error and clears only the password', async ({ page }) => {
  await page.goto('/cms/login');
  await page.getByLabel('Email').fill(E2E_OWNER.email);
  await page.getByLabel('Password').fill('not the right password');
  await page.getByRole('button', { name: 'Sign in' }).click();

  // By text: Next's route announcer is also a `role="alert"` region.
  await expect(page.getByText('The email or password is incorrect.')).toBeVisible();
  await expect(page.getByLabel('Email')).toHaveValue(E2E_OWNER.email);
  await expect(page.getByLabel('Password')).toHaveValue('');
  expect(page.url()).not.toContain('password');
});

test('cms-panel-shell.E2E16 / AC21 — a signed-in browser skips the signed-out screens', async ({ page }) => {
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);

  await page.goto('/cms/login?next=%2Fcms%2Fdesign');
  await expect(page).toHaveURL(/\/cms\/design$/, { timeout: 30_000 });
  for (const path of ['/cms/login', '/cms/register', '/cms/forgot-password', '/cms/verify']) {
    await page.goto(path);
    await expect(page, path).toHaveURL(/\/cms$/, { timeout: 30_000 });
  }

  // A notice means the session just ended: the form shows without asking.
  await page.goto('/cms/login?notice=signed-out');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('cms-panel-shell.E2E12 / AC12 — CMS pages are noindex, nofollow', async ({ page }) => {
  await page.goto('/cms/login');

  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex.*nofollow/);
});

test('cms-panel-shell.E2E14 / AC3 — a newer sign-in elsewhere sends this browser to sign-in with a notice', async ({ browser }) => {
  const first = await browser.newContext();
  const second = await browser.newContext();
  const pageA = await first.newPage();
  const pageB = await second.newPage();
  await signIn(pageA, E2E_OWNER.email, E2E_OWNER.password);
  await signIn(pageB, E2E_OWNER.email, E2E_OWNER.password);

  const refreshes: string[] = [];
  pageA.on('request', (request) => {
    if (request.url().includes('/auth/refresh')) refreshes.push(request.url());
  });
  await pageA.reload();

  await expect(pageA).toHaveURL(/\/cms\/login\?.*notice=signed-out-elsewhere/, { timeout: 30_000 });
  await expect(pageA.getByText('signed in somewhere else')).toBeVisible();
  expect(refreshes).toEqual([]);
  await first.close();
  await second.close();
});

test('cms-panel-shell.AC16, AC17 — registration, then the emailed code signs the new user in', async ({ page }) => {
  const email = uniqueEmail('register');

  await registerAndVerify(page, email, 'New Journey User');

  await expect(page.getByText(/\/new-journey-user/)).toBeVisible();
});

test('cms-panel-shell.E2E15 / AC15 — forgot password: a wrong code, then the right one, then sign in', async ({ page, context }) => {
  const email = uniqueEmail('reset');
  await registerAndVerify(page, email, 'Reset User');
  await context.clearCookies();

  const before = await mailCount(email);
  await page.goto('/cms/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send a code' }).click();
  const code = await nextCode(email, before);
  await page.getByLabel('Code from the email').fill(code === '000000' ? '111111' : '000000');
  await page.getByLabel('New password').fill('the reset e2e password');
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page.getByText('That code is not valid')).toBeVisible();
  expect(page.url()).not.toMatch(/\d{6}/);

  await page.getByLabel('Code from the email').fill(code);
  await page.getByRole('button', { name: 'Set new password' }).click();
  await expect(page).toHaveURL(/notice=password-updated/);
  await expect(page.getByText('Your password was updated')).toBeVisible();
  await signIn(page, email, 'the reset e2e password');
});

test('cms-panel-shell.E2E10 / AC14 — keyboard-only sign-in with a visible focus ring', async ({ page }) => {
  await page.goto('/cms/login');
  // The form renders once the session check answers "signed out" (AC21).
  await expect(page.getByLabel('Email')).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Email')).toBeFocused();
  const outline = await page.getByLabel('Email').evaluate((element) => getComputedStyle(element).outlineStyle);
  expect(outline).not.toBe('none');
  await page.keyboard.type(E2E_OWNER.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.keyboard.type(E2E_OWNER.password);
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible({ timeout: 30_000 });
});

test('cms-panel-shell.E2E11 / AC14 — no serious or critical axe violations on the CMS screens', async ({ page }) => {
  for (const path of ['/cms/login', '/cms/register', '/cms/forgot-password', '/cms/verify']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await seriousViolations(page), path).toEqual([]);
  }
  await signIn(page, E2E_OWNER.email, E2E_OWNER.password);
  expect(await seriousViolations(page), '/cms').toEqual([]);
});
