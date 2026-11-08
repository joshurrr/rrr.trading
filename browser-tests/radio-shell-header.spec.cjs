const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

for (const width of [320, 375, 430, 1440]) {
  test(`radio shell owns the header at ${width}px without a referrer`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname !== 'rrr.trading') return route.fulfill({ json: {} });
      let file = path.join(process.cwd(), url.pathname);
      if (fs.statSync(file, { throwIfNoEntry: false })?.isDirectory()) file = path.join(file, 'index.html');
      if (!fs.existsSync(file)) return route.fulfill({ status: 404 });
      await route.fulfill({ path: file, headers: { 'referrer-policy': 'no-referrer' } });
    });
    await page.goto('https://rrr.trading/radio-shell.html?route=/');
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
