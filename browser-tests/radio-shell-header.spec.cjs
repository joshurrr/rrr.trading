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

test('hero reflects regular market sessions on the Brisbane clock', async ({ page }) => {
  const cases = [
    ['2026-11-15T07:52:00+10:00', 'SUNDAY – MARKETS CLOSED'],
    ['2026-11-15T10:11:00+10:00', 'SUNDAY – MARKETS CLOSED'],
    ['2026-11-14T06:59:59+10:00', 'SATURDAY – US SESSION'],
    ['2026-11-14T07:00:00+10:00', 'SATURDAY – MARKETS CLOSED'],
    ['2026-11-16T07:00:00+10:00', 'MONDAY – MARKETS CLOSED'],
    ['2026-11-16T10:00:00+10:00', 'MONDAY – ASIAN SESSION'],
    ['2026-11-16T12:30:00+10:00', 'MONDAY – MARKETS CLOSED'],
    ['2026-11-16T13:30:00+10:00', 'MONDAY – ASIAN SESSION'],
    ['2026-11-16T18:00:00+10:00', 'MONDAY – EUROPEAN SESSION'],
    ['2026-11-16T23:30:00+10:00', 'MONDAY – EUROPEAN SESSION'],
    ['2026-11-17T00:30:00+10:00', 'TUESDAY – US SESSION'],
    // Friday close moves one Brisbane hour when US daylight saving starts.
    ['2026-03-07T06:30:00+10:00', 'SATURDAY – US SESSION'],
    ['2026-03-14T06:30:00+10:00', 'SATURDAY – MARKETS CLOSED'],
    // The Brisbane opening hour also shifts across the November transition.
    ['2026-10-30T23:30:00+10:00', 'FRIDAY – US SESSION'],
    ['2026-11-02T23:30:00+10:00', 'MONDAY – EUROPEAN SESSION'],
  ];

  await page.clock.install({ time: new Date('2026-11-15T07:51:00+10:00') });
  await page.clock.pauseAt(new Date(cases[0][0]));
  await page.goto('https://rrr.trading/radio-shell.html?route=/');
  const heading = page.locator('.header-session-title:visible');
  await expect(page.locator('#header-system-status')).toContainText('LIVE AI MONITORING 24/7');
  for (const [time, expected] of cases) {
    await page.clock.setSystemTime(new Date(time));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await expect(heading, time).toHaveText(expected);
  }
  await page.clock.setSystemTime(new Date('2026-11-14T06:59:00+10:00'));
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await expect(heading).toHaveText('SATURDAY – US SESSION');
  await page.clock.runFor(60_000);
  await expect(heading).toHaveText('SATURDAY – MARKETS CLOSED');
});

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
