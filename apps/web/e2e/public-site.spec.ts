/**
 * The public site in a real browser (`public-site-rendering.T02`–`T07`; E2E01–E2E11, E2E13–E2E15,
 * VR01–VR03), against the seeded owner's portfolio, published through the CMS API. E2E12 (an API
 * stopped mid-run) is covered by `published-source.spec.ts` (AC17): the shared harness cannot
 * stop its API without failing every later journey.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

import { CmsApi } from './cms-api.ts';
import { E2E_OWNER } from './support.ts';

test.describe.configure({ mode: 'serial' });

let cms: CmsApi;
let slug: string;

/** A minimal PDF: the API checks the magic bytes, not the rest. */
const PDF = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(256, 32)]);

const SECTION_ORDER = ['hero', 'about', 'work', 'experience', 'stack', 'contact'];

test.beforeAll(async ({ playwright }, testInfo) => {
  cms = await CmsApi.signIn(playwright.request, String(testInfo.project.use.baseURL), E2E_OWNER);
  slug = await cms.slug();
  await cms.fixSeedPlaceholder();
  await cms.setResume(await cms.uploadResume(PDF, 'resume.pdf'));
  await cms.publish();
});

test.afterAll(async () => {
  await cms.dispose();
});

async function openPortfolio(page: Page): Promise<void> {
  const response = await page.goto(`/${slug}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
}

test('public-site-rendering.E2E15 / AC20 — the platform home links to sign in and sign up, and shows no portfolio', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Portfolio Builder', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/cms/register');
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/cms/login');
  await expect(page.locator('[data-theme-root]')).toHaveCount(0);
});

test('public-site-rendering.E2E02 / AC2 — an unknown slug is a 404 not-published page marked noindex', async ({ page }) => {
  const response = await page.goto('/no-such-portfolio');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'This portfolio has not been published yet' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('public-site-rendering.E2E01, E2E14 / AC1, AC10 — every section in order; the theme in the server HTML', async ({ page, request }) => {
  await openPortfolio(page);
  const ids = await page.locator('main section[id]').evaluateAll((sections) => sections.map((section) => section.id));
  // Earlier journeys may have reordered the sections; the page follows the saved order.
  expect(ids).toEqual(await cms.publishedOrder());
  expect([...ids].sort()).toEqual([...SECTION_ORDER].sort());

  const html = await (await request.get(`/${slug}`)).text();
  expect(html).toContain('data-theme-root');
  expect(html).toMatch(/--color-accent:\s*#[0-9a-f]{6}/i);
  expect(html).toContain('--font-sans:var(--font-');
});

test('public-site-rendering.E2E03 / AC11 — a published edit shows on the next load', async ({ page }) => {
  const lead = `Fresh heading ${String(Date.now())}`;
  await cms.editSection('hero', (data) => {
    (data as { heading: { lead: string } }).heading.lead = lead;
  });
  await cms.publish();
  await openPortfolio(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText(lead);
});

test('public-site-rendering.E2E04, E2E07 / AC3, AC4, AC5 — the nav at 1440 and 390; the résumé opens from the public API', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPortfolio(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  for (const label of ['About', 'Work', 'Experience', 'Stack', 'Contact']) await expect(nav.getByRole('link', { name: label, exact: true })).toBeVisible();
  await expect(nav.getByRole('button', { name: 'Menu' })).toBeHidden();
  const resume = nav.getByRole('link', { name: 'Résumé' });
  await expect(resume).toHaveAttribute('target', '_blank');
  const href = await resume.getAttribute('href');
  expect(href).toMatch(new RegExp(`^/api/v1/public/portfolios/${slug}/assets/[^/]+/resume\\.pdf$`));
  const file = await page.request.get(href ?? '');
  expect(file.status()).toBe(200);
  expect(file.headers()['content-type']).toBe('application/pdf');

  const box = await nav.boundingBox();
  expect(Math.abs((box?.x ?? 0) + (box?.width ?? 0) / 2 - 720)).toBeLessThan(2);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(nav.getByRole('link', { name: 'About', exact: true })).toBeHidden();
  await expect(nav.getByRole('link', { name: 'Résumé' })).toBeVisible();
  const menu = nav.getByRole('button', { name: 'Menu' });
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(nav.getByRole('link', { name: 'Work', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await menu.click();
  await nav.getByRole('link', { name: 'Stack', exact: true }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page).toHaveURL(/#stack$/);
});

test('public-site-rendering.E2E05, E2E06 / AC6 — Tab reaches the skip link first; a nav link moves to its section and heading', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPortfolio(page);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();

  for (const [label, type] of [['Work', 'work'], ['Contact', 'contact']] as const) {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`#${type}$`));
    await expect(page.locator(`#${type}-heading`)).toBeFocused();
    await expect(page.locator(`#${type}`)).toBeInViewport();
  }
});

test('public-site-rendering.E2E08 / AC8, AC9 — head tags, JSON-LD without email, robots and sitemap', async ({ page, request, baseURL }) => {
  await openPortfolio(page);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${String(baseURL)}/${slug}`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /.+/);
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', /summary/);
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}') as Record<string, unknown>;
  expect(ld).toMatchObject({ '@type': 'Person' });
  expect(ld).not.toHaveProperty('email');
  expect(JSON.stringify(ld)).not.toContain('@portfolio.test');

  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toContain('Allow: /');
  expect(robots).toContain('Disallow: /cms');
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain(`<loc>${String(baseURL)}/</loc>`);
  expect(sitemap).toContain(`<loc>${String(baseURL)}/${slug}</loc>`);
});

test('public-site-rendering.E2E09, VR03 / AC15 — no horizontal scroll at 390, 768, 1024 and 1440', async ({ page }) => {
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await openPortfolio(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `scroll width at ${String(width)}`).toBeLessThanOrEqual(0);
  }
});

test('public-site-rendering.VR01, VR02 / AC14 — the reference layout at 1440 and 390, with screenshots for review', async ({ page }, testInfo) => {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openPortfolio(page);
    await page.evaluate(() => document.fonts.ready);
    const geometry = await page.evaluate(() =>
      [...document.querySelectorAll('main section[id]')].map((section) => {
        const rect = section.getBoundingClientRect();
        return { id: section.id, top: rect.top + window.scrollY, width: rect.width };
      }),
    );
    geometry.slice(1).forEach((section, index) => {
      expect(section.top).toBeGreaterThan(geometry[index]?.top ?? 0);
    });
    for (const section of geometry) expect(section.width).toBe(width);
    const footer = page.locator('footer');
    const lines = await footer.locator('p').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().top));
    if (width >= 768) expect(Math.abs((lines[0] ?? 0) - (lines[1] ?? 0))).toBeLessThan(8);
    else expect(lines[1] ?? 0).toBeGreaterThan(lines[0] ?? 0);
    await testInfo.attach(`page-${String(width)}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  }
});

test('public-site-rendering.E2E11 / AC19 — landmarks, one h1, no skipped levels, no serious axe violations at both widths', async ({ page }) => {
  for (const [width, height] of [[1440, 900], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await openPortfolio(page);
    for (const role of ['banner', 'navigation', 'main', 'contentinfo'] as const) await expect(page.getByRole(role).first()).toBeAttached();
    await expect(page.locator('h1')).toHaveCount(1);
    const levels = await page.locator('h1, h2, h3, h4, h5, h6').evaluateAll((headings) => headings.map((heading) => Number(heading.tagName[1])));
    levels.slice(1).forEach((level, index) => {
      expect(level - (levels[index] ?? level)).toBeLessThanOrEqual(1);
    });
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
    expect(serious.map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`)).toEqual([]);
  }
});

test('public-site-rendering.E2E10 / AC18 — without JavaScript the content, anchors and mail link work', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  await openPortfolio(page);
  for (const type of SECTION_ORDER) await expect(page.locator(`#${type}`)).toBeVisible();
  // Server-rendered in both the desktop row and the (closed) mobile menu.
  await expect(page.getByRole('navigation', { name: 'Main' }).locator('a[href="#about"]').first()).toBeAttached();
  await expect(page.locator('a[href^="mailto:"]').first()).toBeAttached();
  await context.close();
});

test('public-site-rendering.E2E13 / Edge — with contact hidden there is no filled pill and no broken anchor', async ({ page }) => {
  await cms.editSection('hero', (data) => {
    (data as { secondaryCta: { target: unknown } }).secondaryCta.target = { kind: 'url', url: 'https://example.test/contact' };
  });
  await cms.setVisible('contact', false);
  await cms.publish();
  await page.setViewportSize({ width: 1440, height: 900 });
  await openPortfolio(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Contact', exact: true })).toHaveCount(0);
  await expect(page.locator('#contact')).toHaveCount(0);
  const anchors = await page.locator('a[href^="#"]').evaluateAll((links) => links.map((link) => link.getAttribute('href')?.slice(1) ?? ''));
  for (const id of anchors) await expect(page.locator(`[id="${id}"]`)).toHaveCount(1);
});
