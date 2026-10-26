'use strict';
const { test, expect } = require('@playwright/test');

test('homepage and Explorer open identical XMR and 1000PEPE Asset Analysis', async ({ page }) => {
  const now = new Date().toISOString(), expires = new Date(Date.now() + 3600000).toISOString();
  const symbols = ['XMR', '1000PEPE'];
  const rows = symbols.map((symbol, i) => ({ symbol: symbol + 'USDT', exchange: 'bybit', instrument_type: 'linear_perpetual', side: 'LONG', rank: i + 1, timeframe: '1h', momentum_support: 'FAVOURS', return_pct: 1, observed_at: now, expires_at: expires, state: 'CURRENT', provenance: { cycle_started_at: now } }));
  const shortlists = Object.fromEntries(['LONG', 'SHORT'].map(side => [side, { state: 'CURRENT', source_at: now, observed_at: now, expires_at: expires, purpose: 'RESEARCH_RANKING_ONLY', items: side === 'LONG' ? rows : [], provenance: { cycle_started_at: now } }]));
  const positions = rows.map(row => ({ id: row.symbol, symbol: row.symbol, exchange: 'bybit', side: 'SHORT', availability: 'AVAILABLE', quantity: '1', entry_price: '100', current_mark: '102', unrealized_pnl: '2', leverage: '1', entered_at: now, mark_observed_at: now, mark_expires_at: expires }));
  const paper = { version: 'paper-read-api-v1', mode: 'paper', served_at: now, open_positions: { availability: 'AVAILABLE', items: positions }, completed_trades: { availability: 'AVAILABLE', items: [] }, overview: { shortlists, research: { catalogue: { state: 'CURRENT', observed_at: now, pool_asset_count: 2, assessed_count: 2, eligible_count: 2, assets: rows.map(row => ({ symbol: row.symbol, pair: row.symbol + '/USDT:USDT', technically_assessed: true, rankings: { LONG: { rank: row.rank } } })) } } } };
  paper.overview.rankings = shortlists;
  const evidence = { version: 'asset-analysis-read-v1', mode: 'paper', read_only: true, availability: 'AVAILABLE', shortlists, assets: rows.map(row => ({ identity: { exchange: row.exchange, instrument_id: row.symbol, instrument_type: row.instrument_type }, selection: row, technical: {}, luna: { status: 'NOT_ASSESSED' }, sol: { records: [] }, positions_status: 'AVAILABLE', trades_status: 'AVAILABLE', positions: [], trades: [{ id: row.symbol + '-closed', side: 'LONG', entered_at: now, closed_at: now, exit_reason: row.symbol + ' fixture exit', net_pnl: 0 }] })) };
  const requests = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://v4.rrr.trading/**', route => {
    requests.push(route.request().url());
    return route.fulfill({ json: route.request().url().endsWith('/v4/asset-analysis') ? evidence : paper });
  });
  await page.route('https://api.rrr.trading/**', route => { requests.push(route.request().url()); return route.fulfill({ json: {} }); });
  await page.route('https://api.bybit.com/**', route => {
    const url = new URL(route.request().url()); requests.push(url.href);
    const price = url.searchParams.get('symbol') === 'XMRUSDT' ? '102' : '0.01';
    return route.fulfill({ json: { retCode: 0, result: { list: url.pathname.endsWith('/tickers') ? [{ lastPrice: price, price24hPcnt: '0.02', highPrice24h: price, lowPrice24h: price, turnover24h: '1000' }] : Array.from({ length: 20 }, (_, i) => [String(Date.now() - i * 900000), price, price, price, price, '10']) } } });
  });
  await page.route('https://stream.radiorrr.com/**', route => route.fulfill({ body: '' }));
  const structures = [];
  for (const path of ['/', '/asset-explorer/']) {
    await page.goto(path);
    const frame = page.frameLocator('#page-content'), modal = frame.locator('#homepage-analysis-modal');
    await expect(modal).toHaveCount(1);
    const initialReads = requests.filter(url => url.endsWith('/v4/asset-analysis')).length;
    for (const symbol of [...symbols, 'XMR']) {
      const trigger = path === '/' ? frame.locator('#home-position-list .home-position').filter({ has: frame.getByRole('heading', { name: symbol + 'USDT', exact: true }) }) : frame.locator(`.candidate-portrait[data-symbol="${symbol}"] button`).first();
      await expect(trigger).toBeVisible();
      const before = requests.length;
      await (path === '/' ? trigger.locator('.home-position-name h3') : trigger).click();
      await expect(modal).toBeVisible();
      await expect(modal.locator('#homepage-analysis-title')).toHaveText(symbol + ' — Asset Analysis');
      const tabs = ['Overview', 'Technical Analysis', 'News & Intelligence', 'AI Decisions', 'Trade History'];
      await expect(modal.getByRole('tab')).toHaveText(tabs);
      await expect(modal.locator('.aa-chart svg')).toBeVisible();
      await expect(modal.locator('.aa-market')).toContainText(symbol + ' / USDT');
      await expect(modal.locator('.aa-market')).toContainText(symbol === 'XMR' ? '102 USDT' : '0.01 USDT');
      await expect(modal.locator('.aa-position-card')).toContainText('OPEN SHORT');
      if (symbol === 'XMR') await page.screenshot({ path: `.runtime/shared-analysis-${path === '/' ? 'home' : 'explorer'}.png` });
      const marketCalls = requests.slice(before).filter(url => url.includes('api.bybit.com'));
      expect(marketCalls.filter(url => url.includes('/tickers?'))).toHaveLength(1);
      expect(marketCalls.filter(url => url.includes('/kline?'))).toHaveLength(1);
      for (const name of tabs.slice(1)) {
        const tab = modal.getByRole('tab', { name, exact: true });
        await tab.click(); await expect(tab).toHaveAttribute('aria-selected', 'true');
      }
      await expect(modal.locator('#asset-analysis-detail')).toContainText(symbol + 'USDT fixture exit');
      if (symbol === '1000PEPE') structures.push(await modal.locator('.homepage-analysis-dialog > header').evaluate(el => el.outerHTML));
      await modal.getByRole('button', { name: 'Close Asset Analysis', exact: true }).click();
      await expect(modal).toBeHidden(); await expect(trigger).toBeFocused();
      await expect(page.locator('#asset-intelligence-dialog')).toBeHidden();
    }
    expect(requests.filter(url => url.endsWith('/v4/asset-analysis')).length - initialReads).toBe(1);
    await expect(frame.locator('#asset-intelligence-dialog')).toHaveCount(path === '/' ? 1 : 0);
  }
  expect(structures[0]).toBe(structures[1]);
  expect(requests.some(url => url.includes('/intelligence/assets/'))).toBe(false);
  expect(errors).toEqual([]);
});
