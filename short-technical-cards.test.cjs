const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const server = http.createServer((req, res) => {
    let file = path.join(__dirname, new URL(req.url, 'http://localhost').pathname);
    if (req.url.split('?')[0].endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (err, data) => {
      if (err) return res.writeHead(404).end();
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.route('https://api.rrr.trading/**', route => route.fulfill({ status: 503 }));
    await page.route('https://stream.radiorrr.com/**', route => route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/demo/15minbot/`);
    await page.waitForFunction(() => typeof window.renderAssetBranches === 'function');
    const render = async states => page.evaluate(states => window.renderAssetBranches({ market_scan: states.map((state, i) => ({ pair: ['NEAR', 'HYPE', 'ENA'][i] + '/USDT:USDT', state, direction: state === 'SIGNAL' ? 'LONG' : null, timestamp: new Date().toISOString() })) }), states);
    await render(['NO SIGNAL', 'OPEN', 'SIGNAL']);
    assert.equal(await page.locator('[data-stage=technical] .asset-path').count(), 2);
    assert.equal(await page.locator('[data-stage=technical] [data-pair="NEAR/USDT:USDT"]').count(), 0);
    assert.equal(await page.locator('[data-stage=daily] .asset-path').count(), 2);
    assert.equal(await page.locator('[data-stage=daily] [data-pair="NEAR/USDT:USDT"]').count(), 0);
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await page.evaluate(() => window.assetFlowUnavailable('UNAVAILABLE'));
    assert.match(await page.locator('[data-stage=technical]').innerText(), /UNAVAILABLE/);
    await page.evaluate(() => window.renderAssetBranches({market_scan:[{pair:'ENA/USDT:USDT',state:'SIGNAL',timestamp:new Date(Date.now()-3600000).toISOString()}]}));
    assert.match(await page.locator('[data-stage=technical]').innerText(), /STALE OBSERVATION/);
    await render(['NO SIGNAL', 'NO SIGNAL', 'UNKNOWN']);
    assert.equal(await page.locator('[data-stage=technical] .asset-path').count(), 0);
    assert.equal(await page.locator('[data-stage=daily] .asset-path').count(), 0);
    assert.match(await page.locator('[data-stage=technical]').innerText(), /No entry candidates/);
    console.log('PASS: active technical cards, idle empty state, unavailable/stale states, desktop/mobile layout.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
