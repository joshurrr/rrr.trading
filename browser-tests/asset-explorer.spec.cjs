'use strict';
const { test, expect } = require('@playwright/test');

test('Asset Explorer shares homepage cards and opens the shared asset details', async ({ page }) => {
  const now = new Date().toISOString();
  const catalogue = { state: 'CURRENT', observed_at: now, pool_asset_count: 3, assessed_count: 1, eligible_count: 3,
    excluded_counts: {}, assets: [
      { symbol: 'BTCUSDT', pair: 'BTCUSDT/USDT:USDT', asset: 'Bitcoin', technically_assessed: true, rankings: { LONG: { rank: 1 } } },
      { symbol: 'ETHUSDT', pair: 'ETHUSDT/USDT:USDT', asset: 'Ethereum', technically_assessed: false, rankings: {} },
      { symbol: 'SOLUSDT', pair: 'SOLUSDT/USDT:USDT', asset: 'Solana', technically_assessed: false, rankings: {} },
    ] };
  const details = { asset: { symbol: 'BTC', name: 'Bitcoin', exchange: 'bybit', market_type: 'linear_perpetual' },
    decision: { available: false, freshness: 'UNAVAILABLE' }, execution: { active_position: false } };
  await page.route('https://v4.rrr.trading/**', route => route.request().url().endsWith('/v4/paper')
    ? route.fulfill({ json: { version: 'paper-read-api-v1', overview: { research: { catalogue } } } })
    : route.fulfill({ json: {} }));
  await page.route('https://api.rrr.trading/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v2/intelligence/assets/BTC') return route.fulfill({ json: details });
    return route.fulfill({ json: {} });
  });
  await page.goto('/radio-shell.html?route=/asset-explorer/');
  const frame = page.frameLocator('#page-content');
  const cards = frame.locator('#universe-assets .candidate-portrait');
  await expect(cards).toHaveCount(3);
  const button = cards.first().locator('.universe-bubble');
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('data-intelligence-symbol', 'BTC');
  await expect(cards.nth(0).locator('.universe-rank')).toHaveText('LONG #1');
  await expect(cards.nth(1).locator('.universe-rank')).toHaveText('ELIGIBLE');
  await expect(cards.nth(1).locator('.universe-score')).toHaveText('—');
  await expect(cards.nth(1).locator('.candidate-direction')).toBeHidden();
  await expect(cards.nth(1).locator('.candidate-context')).toContainText('No saved LONG/SHORT ranking');
  const desktopStyle = await button.evaluate(el => ({ height: getComputedStyle(el).height, background: getComputedStyle(el).backgroundColor }));
  expect(desktopStyle.height).toBe('205px');

  await frame.locator('#explorer-universe').selectOption('assessed');
  await expect(cards).toHaveCount(1);
  await frame.locator('#explorer-universe').selectOption('all');
  await frame.locator('#explorer-sort').selectOption('alpha');
  await expect(cards.first()).toHaveAttribute('data-symbol', 'BTC');
  await cards.first().locator('.universe-bubble').focus();
  await expect(cards.first().locator('.universe-bubble')).toBeFocused();
  await page.keyboard.press('Enter');
  const modal = page.locator('#asset-intelligence-dialog');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('BTC — Bitcoin');
  for (const name of ['Overview', 'Trades', 'Intelligence', 'News & Market', 'Advanced']) {
    const tab = modal.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(cards.first().locator('.universe-bubble')).toBeVisible();
    expect(await frame.locator('html').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
  }
});
