const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');
(async () => {
  const server = http.createServer((req, res) => {
    let name = new URL(req.url, 'http://local').pathname;
    if (name.endsWith('/')) name += 'index.html';
    fs.readFile(path.join(__dirname, name), (error, data) => {
      if (error) return res.writeHead(404).end();
      res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage(), calls = [], now = new Date().toISOString();
    let mode = 'data';
    const catalogue = { state: 'CURRENT', observed_at: now, pool_asset_count: 3, assessed_count: 2, eligible_count: 6,
      screened_instrument_count: 8, health: 'AVAILABLE', excluded_counts: { invalid_crypto_ticker: 2 },
      assets: [
        { symbol: 'BTCUSDT', pair: 'BTCUSDT/USDT:USDT', asset: 'BTC', technically_assessed: true, rankings: { LONG: { rank: 2, timeframe: '1h', return_pct: 1.2 } } },
        { symbol: 'ETHUSDT', pair: 'ETHUSDT/USDT:USDT', asset: 'ETH', technically_assessed: true, rankings: { SHORT: { rank: 1, timeframe: '4h', return_pct: -2 } } },
        { symbol: 'SOLUSDT', pair: 'SOLUSDT/USDT:USDT', asset: 'SOL', technically_assessed: false, rankings: {}, ranking_excluded_reasons: ['ticker_missing_invalid_or_expired'] }
      ] };
    await page.route('**/*', async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.protocol !== 'https:') return route.continue();
      calls.push({ path: url.pathname, method: req.method() });
      if (url.hostname === 'v4.rrr.trading' && url.pathname === '/v4/paper') {
        if (mode === 'unavailable') return route.fulfill({ status: 503, body: '{}' });
        const value = mode === 'empty' ? { ...catalogue, pool_asset_count: 0, assessed_count: 0, eligible_count: 0, assets: [] } : catalogue;
        return route.fulfill({ json: { version: 'paper-read-api-v1', overview: { research: { catalogue: value } } } });
      }
      return route.abort();
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/asset-explorer/');
    const f = page.frameLocator('#page-content');
    await f.locator('#explorer-count').filter({ hasText: '3 pool assets' }).waitFor();
    assert.match(await f.locator('#explorer-status').innerText(), /3 assets in the saved liquidity pool · 2 technically assessed · 6 eligible/);
    assert.match(await f.locator('#explorer-status').innerText(), /invalid crypto ticker: 2/);
    assert.equal(await f.locator('.candidate-portrait').count(), 3);
    assert.equal(await f.locator('#explorer-pool').isDisabled(), true);
    await f.locator('#explorer-universe').selectOption('assessed'); assert.equal(await f.locator('.candidate-portrait').count(), 2);
    await f.locator('#explorer-universe').selectOption('not-assessed'); assert.equal(await f.locator('.candidate-portrait').count(), 1);
    await f.locator('#explorer-universe').selectOption('all');
    await f.locator('#explorer-universe').selectOption('excluded'); assert.equal(await f.locator('.candidate-portrait').count(), 1); assert.match(await f.locator('.universe-analysis-reason').innerText(), /ticker_missing_invalid_or_expired/);
    await f.locator('#explorer-universe').selectOption('all');
    await f.locator('#explorer-sort').selectOption('high'); assert.equal(await f.locator('.candidate-portrait').first().getAttribute('data-symbol'), 'ETHUSDT');
    await f.locator('#explorer-sort').selectOption('alpha'); assert.equal(await f.locator('.candidate-portrait').first().getAttribute('data-symbol'), 'BTCUSDT');
    await f.locator('#explorer-search').fill('SOL'); assert.equal(await f.locator('.candidate-portrait').count(), 1);
    assert.match(await f.locator('#explorer-snapshot').innerText(), /Last successful universe assessment/);
    await f.locator('#explorer-refresh').click();
    assert(calls.every(c => c.path === '/v4/paper' && c.method === 'GET'));
    assert.equal(await f.locator('.candidate-portrait button').first().isEnabled(), true);
    assert.equal(await f.locator('.candidate-portrait button').first().getAttribute('data-intelligence-symbol'), 'BTC');
    assert.equal(await f.locator('.candidate-portrait .universe-score').first().innerText(), '—');
    assert.equal(await f.locator('.candidate-portrait .candidate-direction').first().isVisible(), false);
    mode = 'unavailable'; await f.locator('#explorer-refresh').click(); await f.locator('#explorer-status').filter({ hasText: 'unavailable' }).waitFor();
    assert.equal(await f.locator('#explorer-count').innerText(), 'Asset count unavailable');
    mode = 'empty'; await f.locator('#explorer-refresh').click(); await f.locator('#explorer-status').filter({ hasText: '0 assets in the saved liquidity pool' }).waitFor();
    assert.match(await f.locator('#universe-assets').innerText(), /zero eligible pool assets/);
    console.log('PASS Asset Explorer: V4-only GET, all pool assets, technical-assessment filter, saved ranking sort, search, aggregate exclusions, timestamp, unavailable vs valid zero.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
