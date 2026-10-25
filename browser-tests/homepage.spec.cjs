'use strict';
const { test, expect } = require('@playwright/test');

const assets = 'BTC ETH SOL XRP LINK ONDO AAVE UNI HYPE INJ'.split(' ');
const now = new Date().toISOString();
const universe = {
  schema_version: 1, status: 'ok', entry_eligible: false, universe_version: 'playwright-fixture',
  generated_at: now, valid_until: new Date(Date.now() + 600_000).toISOString(),
  assets: assets.map((symbol, i) => ({ symbol, pair: `${symbol}/USDT:USDT`, rank: i + 1, opportunity_score: 70 - i, reason: 'Browser fixture', approved_for_new_entries: false })),
};
const shortlist = side => ({ state: 'CURRENT', observed_at: now, expires_at: new Date(Date.now() + 600_000).toISOString(), purpose: 'RESEARCH_RANKING_ONLY', items: assets.slice(0, 2).map((symbol, i) => ({ symbol: `${symbol}USDT`, exchange: 'bybit', instrument_type: 'linear_perpetual', side, rank: i + 1, timeframe: '1h', momentum_support: 'UNKNOWN', return_pct: 0, observed_at: now, expires_at: new Date(Date.now() + 600_000).toISOString(), state: 'CURRENT' })) });
const entered = new Date(Date.now() - 3_600_000).toISOString();
const closed = new Date(Date.now() - 30_000).toISOString();
const openPosition = { id: 'position-fixture', symbol: 'BTCUSDT', exchange: 'bybit', side: 'LONG', availability: 'AVAILABLE', quantity: '1', entry_price: '100', current_mark: '102', unrealized_pnl: '2', leverage: '2', entered_at: entered, mark_observed_at: new Date(Date.now() - 5_000).toISOString(), mark_expires_at: new Date(Date.now() + 60_000).toISOString(), financials: { position_notional_usdt: '102', margin_used_usdt: '51', estimated_net_pnl_usdt: '2', estimated_net_return_pct: 3.92 }, protection: { status: 'PROTECTED', active_stop: '95' } };
const paper = {
  version: 'paper-read-api-v1', mode: 'paper', served_at: now,
  wallet: { availability: 'AVAILABLE', as_of: now, wallet_balance: '10008', equity: '10010', realized_pnl: '10', unrealized_pnl: '2', entry_fees_paid: '0', exit_fees_paid: '2', valuation_expires_at: new Date(Date.now() + 600_000).toISOString(), field_availability: Object.fromEntries(['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].map(key => [key, 'AVAILABLE'])) },
  open_positions: { availability: 'AVAILABLE', items: [openPosition] },
  completed_trades: { availability: 'AVAILABLE', as_of: now, items: [{ id: 'trade-fixture', symbol: 'ETHUSDT', side: 'SHORT', entered_at: entered, closed_at: closed, entry_price: '110', exit_price: '100', realized_pnl: '10', net_pnl: '8', exit_reason: 'FIXTURE' }] },
  overview: { shortlists: { LONG: shortlist('LONG'), SHORT: shortlist('SHORT') } },
};

async function fixtures(page) {
  const badApi = [];
  const monitoredApi = url => ['api.rrr.trading', 'v4.rrr.trading', 'api.bybit.com'].includes(new URL(url).hostname);
  page.on('console', msg => { if (msg.type() === 'error') badApi.push(`console: ${msg.text()}`); });
  page.on('pageerror', error => badApi.push(`page: ${error.message}`));
  page.on('requestfailed', request => { if (monitoredApi(request.url())) badApi.push(`request: ${request.url()} · ${request.failure()?.errorText}`); });
  page.on('response', response => { const url = new URL(response.url()); if (monitoredApi(response.url()) && response.status() >= 400 && !(url.hostname === 'v4.rrr.trading' && url.pathname === '/v4/asset-analysis')) badApi.push(`HTTP ${response.status()}: ${response.url()}`); });
  await page.route('https://api.rrr.trading/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/trading-universe') return route.fulfill({ json: universe });
    if (path === '/api/market-summary') return route.fulfill({ json: { currency: 'USD', source: 'fixture', markets: assets.map((symbol, i) => ({ symbol, price: 100 + i, price_change_24h: 1.25, updated_at: now })) } });
    if (/^\/api\/v2\/intelligence\/assets\/[A-Z0-9]+$/.test(path)) {
      const symbol = path.split('/').at(-1);
      return route.fulfill({ json: { asset: { symbol, name: symbol === 'BTC' ? 'Bitcoin' : symbol, exchange: 'bybit', market_type: 'linear_perpetual' }, decision: { available: true, freshness: 'FRESH', shadow_mode: true, execution_connected: false, decision: 'NO_GO', reason_summary: 'FIXTURE_ONLY', decision_time: now, evidence_expires_at: new Date(Date.now() + 300_000).toISOString(), timeframe_assessments: Object.fromEntries(['15m','1h','4h'].map(timeframe => [timeframe, { timeframe, status: 'ASSESSED', direction: 'NEUTRAL', score: 0, confidence: 0 }])) }, execution: { active_position: false, health: { mode: 'PAPER', status: 'available', stale: false }, latest_execution: null } } });
    }
    return route.fulfill({ json: {} });
  });
  await page.route('https://v4.rrr.trading/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/v4/paper') return route.fulfill({ json: paper });
    if (path === '/v4/asset-analysis') return route.fulfill({ status: 503 });
    return route.fulfill({ json: {} });
  });
  await page.route('https://api.bybit.com/**', route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/tickers')) return route.fulfill({ json: { retCode: 0, result: { list: [{ lastPrice: '102', price24hPcnt: '0.02', highPrice24h: '105', lowPrice24h: '99', turnover24h: '1000000' }] } } });
    if (url.pathname.endsWith('/kline')) return route.fulfill({ json: { retCode: 0, result: { list: [['1792960000000','100','103','99','102','10'],['1792960900000','102','104','101','103','8']] } } });
    return route.fulfill({ json: { retCode: 0, result: { list: [] } } });
  });
  await page.route('https://stream.radiorrr.com/**', route => route.abort());
  return badApi;
}

test('homepage loads market cards and its asset detail modal, tabs and close behavior', async ({ page }) => {
  const errors = await fixtures(page);
  await page.goto('/');
  const card = page.getByRole('button', { name: 'Inspect BTC asset intelligence' });
  await expect(card).toBeVisible();
  await card.click();
  const modal = page.locator('#asset-intelligence-dialog');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('BTC — Bitcoin');
  await expect(modal.locator('[role=tab]')).toHaveCount(5);
  for (const name of ['Overview', 'Trades', 'Intelligence', 'News & Market', 'Advanced']) {
    const tab = modal.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  await page.screenshot({ path: '.runtime/playwright-home-modal.png', fullPage: true });
  await modal.getByRole('button', { name: 'Close asset intelligence' }).click();
  await expect(modal).toHaveClass(/ai-closing/);
  await expect(modal).toBeHidden();
  await expect(card).toBeFocused();
  await expect.poll(() => errors).toEqual([]);
});

test('homepage sections and card grid fit desktop and mobile widths', async ({ page }) => {
  await fixtures(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Inspect BTC asset intelligence' })).toBeVisible();
  const content = page.frameLocator('#page-content');
  await expect(content.locator('script[src*="/asset-analysis/asset-analysis.js"]')).toHaveAttribute('src', /market-overview/);
  await expect(content.locator('link[href*="/asset-analysis/asset-analysis.css"]')).toHaveAttribute('href', /market-overview/);
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow at ${width}px`).toBeTruthy();
    expect(await content.locator('html').evaluate(el => el.scrollWidth <= el.clientWidth), `iframe overflow at ${width}px`).toBeTruthy();
    if (width === 1440) expect(await content.locator('#v4-overview').evaluate(el => el.getBoundingClientRect().width)).toBeLessThanOrEqual(1200);
    if (width === 390) await page.screenshot({ path: '.runtime/playwright-home-mobile.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => window.SiteNavigation.load('/asset-analysis/'));
  await expect(content.locator('#asset-analysis-title')).toHaveText('Asset Analysis');
  const assetCard = content.locator('#asset-analysis-cards .aa-card').first();
  await expect(assetCard).toBeVisible();
  await assetCard.click();
  const tabs = content.locator('#asset-analysis-tabs');
  for (const name of ['Overview', 'Technical Analysis', 'News & Intelligence', 'AI Decisions', 'Trade History']) {
    const tab = tabs.getByRole('tab', { name, exact: true });
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
  await page.screenshot({ path: '.runtime/playwright-asset-analysis.png', fullPage: true });
});
