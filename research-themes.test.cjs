const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), os = require('node:os');
(async () => {
  const server = http.createServer((req, res) => {
    let file = path.join(__dirname, new URL(req.url, 'http://local').pathname);
    if (req.url.split('?')[0].endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (error, data) => {
      if (error) return res.writeHead(404).end();
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const now = new Date().toISOString();
    const evidence = (series_id, value) => ({ series_id, value, observation_date: '2026-10-01' });
    const theme = (key, supporting_evidence) => ({ id: 'macro:' + key, title: key + ' conditions', category: 'macro', affected_assets: ['ALL'], impact: 'MEDIUM', status: 'current', last_updated: now, review_at: new Date(Date.now() + 3600000).toISOString(), summary: 'RAW=123 (observed 2026-10-01)', supporting_evidence });
    const data = { status: 'available', generated_at: now, themes: [
      theme('equities', [evidence('SP500', 7666.45), evidence('NASDAQCOM', 26871.6)]),
      theme('liquidity', [evidence('NFCI', -0.548), evidence('WALCL', 6743031)]),
      theme('rates', [evidence('DGS2', 4.78), evidence('DGS10', 5.24)]),
      theme('usd', [evidence('DTWEXBGS', 120.33)]),
      theme('volatility', [evidence('VIXCLS', 16.39)])
    ], macro_events: { status: 'unavailable' } };
    await page.route('https://api.rrr.trading/**', route => new URL(route.request().url()).pathname === '/api/research' ? route.fulfill({ json: data }) : route.fulfill({ status: 503 }));
    await page.goto('http://127.0.0.1:' + server.address().port);
    await page.waitForFunction(() => document.querySelectorAll('.theme-summary').length === 5);
    await page.locator('#daily-research>.dashboard-details>summary').click();
    assert.deepEqual(await page.locator('.theme-summary').allTextContents(), [
      'The S&P 500 stands at 7,666.45. The Nasdaq Composite stands at 26,871.6.',
      'US financial conditions are looser than their historical average. The Federal Reserve holds $6.74 trillion in assets.',
      'The 2-year US Treasury yield is 4.78%. The 10-year US Treasury yield is 5.24%.',
      'The broad US dollar index reads 120.33.',
      'The VIX, which measures expected US stock market volatility, reads 16.39.'
    ]);
    assert(!/RAW=|macro · ALL/.test(await page.locator('#research-themes').innerText()));
    assert.equal(await page.locator('.theme-details[open]').count(), 0);
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow at ' + width);
      await page.locator('#daily-research').screenshot({ path: path.join(os.tmpdir(), `rrr-themes-${width}.png`) });
      await page.locator('.theme-details summary').first().click();
      assert.match(await page.locator('.theme-details').first().innerText(), /observed 2026-10-01/);
      assert.equal(await page.locator('.theme-details a').first().getAttribute('href'), 'https://fred.stlouisfed.org/series/SP500');
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('.theme-details summary').first().click();
    }
    for (const [value, expected] of [[1, 'tighter than'], [0, 'in line with']]) {
      data.themes[1].supporting_evidence[0].value = value;
      await page.evaluate(data => renderResearch(data), data);
      assert.match(await page.locator('.theme-summary').nth(1).innerText(), new RegExp(expected));
    }
    data.themes[2].supporting_evidence[0].fresh = false;
    await page.evaluate(data => renderResearch(data), data);
    assert(!/2-year/.test(await page.locator('.theme-summary').nth(2).innerText()));
    assert.match(await page.locator('#research-themes').innerText(), /Stale readings excluded/);
    data.themes[0].supporting_evidence = [{ series_id: 'SP500', value: 'bad', observation_date: '2026-10-01' }];
    await page.evaluate(data => renderResearch(data), data);
    assert.equal(await page.locator('.theme-summary').first().innerText(), 'Current readings are unavailable for this theme.');
    const custom = { ...data.themes[0], id: 'news:upgrade', category: 'crypto', title: 'Network upgrade', summary: '<script>unsafe</script> Upgrade scheduled.' };
    await page.evaluate(data => renderResearch(data), { ...data, themes: [custom] });
    assert.equal(await page.locator('.theme-summary').innerText(), custom.summary);
    assert.equal(await page.locator('#research-themes script').count(), 0);
    await page.evaluate(data => renderResearch(data), { ...data, status: 'stale' });
    assert.equal(await page.locator('.theme-summary').count(), 0);
    assert.match(await page.locator('#research-themes').innerText(), /stale/);
    await page.evaluate(() => renderResearch(null));
    assert.match(await page.locator('#research-themes').innerText(), /unavailable/);
    assert.deepEqual(errors, []);
    console.log('PASS: plain-English themes, evidence dates and sources, NFCI signs, stale/invalid/missing data, safe news text, desktop/tablet/mobile layouts.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
