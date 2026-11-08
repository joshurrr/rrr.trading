const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname !== 'rrr.trading') return route.fulfill({ json: {} });
    let file = path.join(process.cwd(), url.pathname);
    if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
    await route.fulfill({ path: file, headers: { 'referrer-policy': 'no-referrer' } });
  });
});

for (const width of [701, 1440]) {
  test(`radio shell owns the header at ${width}px without a referrer`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('https://rrr.trading/radio-shell.html?route=/');
    await expect(page.locator('#radio-toggle')).toBeVisible();
    const content = page.frameLocator('#page-content');
    await expect(content.locator('main')).toBeVisible();
    await expect(page.locator('.site-header:visible')).toHaveCount(1);
    await expect(page.locator('.operating-modes:visible')).toHaveCount(1);
    expect(await content.locator('[data-site-header]').evaluate(mount => ({
      referrer: document.referrer,
      height: mount.getBoundingClientRect().height
    }))).toEqual({ referrer: '', height: 0 });
    await expect(content.locator('.site-header')).toBeHidden();
    await expect(content.locator('.operating-modes')).toBeHidden();
    const menu = page.locator('#intelligence-shortcuts');
    const toggle = page.locator('[data-page="intelligence"]');
    await toggle.click();
    await expect(menu).toBeVisible();
    await toggle.click();
    await expect(menu).toBeHidden();
    await toggle.click();
    await menu.getByRole('link', { name: 'News & Themes' }).click();
    await expect(page).toHaveURL('https://rrr.trading/news/');
    await expect(content.locator('main')).toBeVisible();
    await expect(content.locator('.site-header')).toBeHidden();
    await expect(menu).toBeHidden();

    // Exercise the same document at top level without the normal shell redirect.
  await page.route('**/radio-navigation.js?*', route => route.fulfill({ body: '' }));
    await page.goto('https://rrr.trading/');
    await expect(page.locator('.site-header')).toBeVisible();
    await expect(page.locator('.operating-modes')).toBeVisible();
  });
}

test.describe('mobile pages', () => {
  test.use({ isMobile: true, hasTouch: true });

  for (const width of [320, 430, 700]) {
    test(`uses direct navigation without a radio player at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('https://rrr.trading/');
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('#page-content')).toHaveCount(0);
      await expect(page.locator('.site-header:visible')).toHaveCount(1);
      await expect(page.locator('.operating-modes:visible')).toHaveCount(1);
      await expect(page.locator('.header-tools')).toBeHidden();
      const toggle = page.locator('[data-page="intelligence"]');
      const menu = page.locator('#intelligence-shortcuts');
      await toggle.tap();
      await expect(menu).toBeVisible();
      await toggle.tap();
      await expect(menu).toBeHidden();
      await toggle.tap();
      await menu.getByRole('link', { name: 'News & Themes' }).tap();
      await expect(page).toHaveURL('https://rrr.trading/news/');
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('#page-content')).toHaveCount(0);
      await expect(page.locator('.header-tools')).toBeHidden();
      await expect(menu).toBeHidden();

      await page.goto('https://rrr.trading/radio-shell.html?route=%2Fasset-explorer%2F%3Fview%3Dall');
      await expect(page).toHaveURL('https://rrr.trading/asset-explorer/?view=all');
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('#page-content')).toHaveCount(0);
  });
  }
});
