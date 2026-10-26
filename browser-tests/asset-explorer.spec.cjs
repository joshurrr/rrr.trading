'use strict';
const { test, expect } = require('@playwright/test');

test('Asset Explorer shares homepage cards and opens the shared asset details', async ({ page }) => {
  const now = new Date().toISOString();
  const extras = Array.from({ length: 16 }, (_, index) => {
    const symbol = `ALT${index + 1}USDT`;
    return { symbol, pair: `${symbol}/USDT:USDT`, asset: symbol.replace(/USDT$/, ''), technically_assessed: false, rankings: {} };
  });
  const catalogue = { state: 'CURRENT', observed_at: now, pool_asset_count: 20, assessed_count: 1, eligible_count: 20,
    excluded_counts: {}, assets: [
      { symbol: 'BTCUSDT', pair: 'BTCUSDT/USDT:USDT', asset: 'Bitcoin', price: 68245.5, change_24h_pct: 2.35, technically_assessed: true, rankings: { LONG: { rank: 1 } } },
      { symbol: 'ETHUSDT', pair: 'ETHUSDT/USDT:USDT', asset: 'Ethereum', change_24h_pct: -1.42, technically_assessed: false, rankings: {} },
      { symbol: 'SOLUSDT', pair: 'SOLUSDT/USDT:USDT', asset: 'Solana', technically_assessed: false, rankings: {} },
      { symbol: '1000PEPEUSDT', pair: '1000PEPEUSDT/USDT:USDT', asset: '1000PEPE', technically_assessed: false, rankings: {} },
      ...extras,
    ] };
  const details = { asset: { symbol: 'BTC', name: 'Bitcoin', exchange: 'bybit', market_type: 'linear_perpetual' },
    decision: { available: false, freshness: 'UNAVAILABLE' }, execution: { active_position: false } };
  await page.route('https://v4.rrr.trading/**', route => route.request().url().endsWith('/v4/paper')
    ? route.fulfill({ json: { version: 'paper-read-api-v1', open_positions: { availability: 'AVAILABLE', items: [{ id: 'open-btc', symbol: 'BTCUSDT' }] }, overview: { research: { catalogue } } } })
    : route.fulfill({ json: {} }));
  await page.route('https://api.rrr.trading/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/v2/intelligence/assets/BTC') return route.fulfill({ json: details });
    return route.fulfill({ json: {} });
  });
  await page.goto('/radio-shell.html?route=/asset-explorer/');
  const frame = page.frameLocator('#page-content');
  const cards = frame.locator('#universe-assets .candidate-portrait');
  await expect(cards).toHaveCount(20);
  const button = cards.first().locator('.universe-bubble');
  await expect(button).toBeEnabled();
  await expect(button).toHaveAttribute('data-intelligence-symbol', 'BTC');
  await expect(cards.nth(0).locator('.candidate-compact-symbol')).toHaveText('BTC');
  await expect(cards.nth(0).locator('.candidate-compact-price')).toHaveText('$68,245.50');
  await expect(cards.nth(0).locator('.candidate-compact-change')).toHaveText('+2.35%');
  await expect(cards.nth(0).locator('.candidate-open-position')).toBeVisible();
  const ethCard = frame.locator('#universe-assets [data-symbol="ETH"]');
  await expect(ethCard.locator('.candidate-compact-price')).toHaveText('—');
  await expect(ethCard.locator('.candidate-compact-change')).toHaveText('−1.42%');
  await expect(ethCard.locator('.candidate-open-position')).toBeHidden();
  for (const forbidden of ['.candidate-art', '.candidate-chart', '.universe-rank', '.universe-score', '.candidate-score-label', '.candidate-direction', '.candidate-context', '.candidate-evidence', '.candidate-compact-pair', '.candidate-compact-eligibility']) {
    await expect(cards.first().locator(forbidden)).toHaveCount(0);
  }
  expect((await cards.allInnerTexts()).join('\n')).not.toMatch(/\b(?:undefined|null)\b/i);
  const longSymbol = frame.locator('#universe-assets [data-symbol="1000PEPE"] .candidate-compact-symbol');
  await expect(longSymbol).toHaveText('1000PEPE');
  await expect(longSymbol).toHaveCSS('white-space', 'nowrap');

  await frame.locator('#explorer-universe').selectOption('assessed');
  await expect(cards).toHaveCount(1);
  await frame.locator('#explorer-universe').selectOption('all');
  await frame.locator('#explorer-sort').selectOption('alpha');
  await expect(cards.first()).toHaveAttribute('data-symbol', '1000PEPE');
  const btcCard = frame.locator('#universe-assets [data-symbol="BTC"]');
  await btcCard.locator('.universe-bubble').click();
  const modal = page.locator('#asset-intelligence-dialog');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('BTC — Bitcoin');
  for (const name of ['Overview', 'Trades', 'Intelligence', 'News & Market', 'Advanced']) {
    const tab = modal.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  await page.keyboard.press('Escape');
  await btcCard.locator('.universe-bubble').focus();
  await page.keyboard.press('Enter');
  await expect(modal).toBeVisible();
  await page.keyboard.press('Escape');

  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(cards.first().locator('.universe-bubble')).toBeVisible();
    expect(await frame.locator('html').evaluate(el => el.scrollWidth <= el.clientWidth)).toBeTruthy();
    const overflow = await cards.evaluateAll(items => items.some(card => card.scrollWidth > card.clientWidth || card.querySelector('button').scrollWidth > card.querySelector('button').clientWidth));
    expect(overflow).toBeFalsy();
    await page.screenshot({ path: `.runtime/asset-explorer-${width}.png`, fullPage: true });
  }
});
