const { chromium } = require('playwright');
const assert = require('node:assert/strict'), fs = require('node:fs'), http = require('node:http'), path = require('node:path');

(async () => {
  const harness = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/candidate-cards.css"><body id="home"><main class="shell"><section id="top-opportunities" class="universe-panel"><div id="universe-assets" class="universe-grid"></div></section></main><script src="/asset-logo.js"></script><script src="/candidate-cards.js"></script>`;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost'), name = url.pathname;
    res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8');
    if (name === '/card-harness.html') return res.end(harness);
    fs.readFile(path.join(__dirname, name.replace(/\/$/, '/index.html')), (err, data) => { if (err) return res.writeHead(404).end(); res.end(data); });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } }), errors = [], calls = [];
    page.on('pageerror', e => errors.push(e.message));
    const now = Date.now(), generated_at = new Date(now - 1000).toISOString(), valid_until = new Date(now + 600000).toISOString();
    const candidates = Array.from({ length: 52 }, (_, i) => ({ symbol: 'ASSET' + String(i).padStart(2, '0'), pair: 'ASSET' + String(i).padStart(2, '0') + '/USDT:USDT', opportunity_score: i === 50 ? null : i === 51 ? 101 : i === 49 ? 0 : 90 - i, trend: 'mixed', reason: 'Saved context. <img src=x onerror=alert(1)>', approved_for_new_entries: i < 30, candidate_rank: i + 1, data_confidence: .5 }));
    let universe = { schema_version: 1, status: 'ok', generated_at, valid_until, universe_version: 'test-version', entry_eligible: true, assets: candidates.slice(0, 10).map((a, i) => ({ ...a, rank: i + 1 })) };
    let pool = { status: 'ok', generated_at, universe_version: universe.universe_version, candidates };
    const assets = Array.from({ length: 110 }, (_, i) => ({ symbol: 'ASSET' + String(i).padStart(2, '0'), name: i === 45 ? 'Full Name Search' : 'Asset ' + i, enabled: true }));
    let fail = false, registryFail = false;
    await page.route('**/*', r => {
      const req = r.request(), u = new URL(req.url());
      if(u.protocol !== 'https:') return r.continue(); if (u.hostname !== 'api.rrr.trading') return r.abort();
      calls.push({ path: u.pathname, method: req.method() });
      if (fail) return r.fulfill({ status: 503 });
      if (u.pathname === '/api/trading-universe') return r.fulfill({ json: universe });
      if (u.pathname === '/api/trading-universe/candidates') return r.fulfill({ json: pool });
      if (u.pathname === '/api/v2/intelligence/assets') return registryFail ? r.fulfill({ status: 503 }) : r.fulfill({ json: { total: assets.length, assets } });
      return r.fulfill({ status: 503 });
    });
    const base = 'http://127.0.0.1:' + server.address().port;
    // Existing callers retain hidden evidence, ranks, directions, size and stable DOM/focus.
    await page.goto(base + '/card-harness.html');
    await page.evaluate(rows => CandidateCards.reconcile(document.getElementById('universe-assets'), rows), universe.assets.map(asset => ({ symbol: asset.symbol, asset })));
    assert.equal(await page.locator('.universe-rank').first().innerText(), '#1');
    assert.ok(await page.locator('.candidate-evidence').first().isHidden());
    assert.equal(await page.locator('.universe-bubble').first().evaluate(e => e.getBoundingClientRect().height), 205);
    await page.locator('.universe-bubble').first().focus();
    await page.evaluate(() => { window.originalCard = document.querySelector('.candidate-portrait'); window.originalButton = document.activeElement; });
    await page.evaluate(rows => CandidateCards.reconcile(document.getElementById('universe-assets'), rows), universe.assets.map(asset => ({ symbol: asset.symbol, asset })));
    assert.ok(await page.evaluate(() => originalCard === document.querySelector('.candidate-portrait') && originalButton === document.activeElement));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(base + '/asset-explorer/');
    const f = page.frameLocator('#page-content');
    await f.locator('#explorer-count').filter({ hasText: '110 available' }).waitFor();
    assert.equal(await f.locator('.candidate-portrait').count(), 35);
    assert.match(await f.locator('#explorer-coverage').innerText(), /50 with saved opportunity scores/);
    assert.equal(await f.locator('.universe-score').first().innerText(), '90');
    const requestCount = calls.length;
    await f.locator('#explorer-search').fill('Full Name Search'); assert.equal(await f.locator('.candidate-portrait').count(), 1); assert.equal(await f.locator('.candidate-portrait').getAttribute('data-symbol'), 'ASSET45');
    await f.locator('#explorer-search').fill('no matches'); assert.match(await f.locator('#universe-assets').innerText(), /No assets match/);
    await f.locator('#explorer-clear').click(); assert.equal(await f.locator('#explorer-search').inputValue(), '');
    await f.locator('#explorer-sort').selectOption('low'); assert.equal(await f.locator('.universe-score').first().innerText(), '0');
    await f.locator('#explorer-sort').selectOption('alpha'); assert.equal(await f.locator('.candidate-portrait').first().getAttribute('data-symbol'), 'ASSET00');
    await f.locator('#explorer-universe').selectOption('top'); assert.equal(await f.locator('.candidate-portrait').count(), 10);
    await f.locator('#explorer-universe').selectOption('outside'); assert.match(await f.locator('#explorer-count').innerText(), /100 matching/);
    await f.locator('#explorer-pool').selectOption('blocked'); assert.equal(await f.locator('.candidate-portrait').count(), 22);
    await f.locator('#explorer-clear').click(); await f.locator('#explorer-more').click(); assert.equal(await f.locator('.candidate-portrait').count(), 70);
    await f.locator('#explorer-more').click(); await f.locator('#explorer-more').click(); assert.equal(await f.locator('.candidate-portrait').count(), 110);
    const displayed = await f.locator('.universe-score').allTextContents(); assert.equal(displayed[49], '0'); assert.ok(displayed.slice(50).every(s => s === '—'));
    assert.equal(calls.length, requestCount, 'Filtering and pagination make no API calls');
    await f.locator('.candidate-evidence summary').first().click(); assert.match(await f.locator('.candidate-evidence').first().innerText(), /Assessed:.*Brisbane/); assert.equal(await f.locator('.candidate-evidence img').count(), 0);
    await f.locator('.universe-bubble').first().click(); await page.locator('#asset-intelligence-dialog[open]').waitFor(); await page.locator('.ai-close').click();
    await page.locator('[aria-controls="intelligence-shortcuts"]').press('ArrowDown'); assert.equal(await page.locator('#intelligence-shortcuts a[href="/asset-explorer/"][aria-current="page"]').count(), 1); await page.keyboard.press('Escape');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 }); await f.locator('#explorer-clear').click();
      assert.ok(await f.locator('html').evaluate(e => e.scrollWidth <= innerWidth));
      const heights = await f.locator('.universe-bubble').evaluateAll(es => es.map(e => e.getBoundingClientRect().height)); assert.ok(Math.max(...heights) - Math.min(...heights) < 1);
      fs.mkdirSync('.runtime', { recursive: true }); await page.screenshot({ path: `.runtime/asset-explorer-${width}.png`, fullPage: true });
      await f.locator('.universe-bubble').first().scrollIntoViewIfNeeded(); await page.screenshot({ path: `.runtime/asset-explorer-cards-${width}.png` });
    }
    universe = { ...universe, valid_until: new Date(now - 1).toISOString() };
    await f.locator('#explorer-refresh').click(); await f.locator('#explorer-snapshot').filter({ hasText: 'STALE' }).waitFor();
    assert.ok(await f.locator('#explorer-universe').isDisabled()); assert.ok(await f.locator('#explorer-pool').isDisabled()); assert.match(await f.locator('.candidate-evidence summary').first().innerText(), /STALE/);
    universe = { ...universe, valid_until }; pool = { ...pool, universe_version: 'older-version' };
    await f.locator('#explorer-refresh').click(); await f.locator('#explorer-snapshot').filter({ hasText: 'VALIDITY UNKNOWN' }).waitFor();
    registryFail = true; await f.locator('#explorer-refresh').click(); await f.locator('#explorer-coverage').filter({ hasText: 'coverage is partial' }).waitFor();
    fail = true; await f.locator('#explorer-refresh').click(); await f.locator('#explorer-coverage').filter({ hasText: 'Asset data unavailable' }).waitFor(); assert.equal(await f.locator('.candidate-portrait').count(), 0);
    assert.equal(await f.locator('#explorer-count').innerText(), 'Asset count unavailable');
    fail = false; registryFail = false; assets.length = 0; universe = { ...universe, assets: [] }; pool = { ...pool, candidates: [] };
    await f.locator('#explorer-refresh').click(); await f.locator('#explorer-coverage').filter({ hasText: '0 registered assets returned' }).waitFor();
    assert.match(await f.locator('#explorer-count').innerText(), /0 matching \/ 0 available/);
    assert.ok(calls.every(c => c.method === 'GET')); assert.ok(calls.every(c => ['/api/trading-universe', '/api/trading-universe/candidates', '/api/v2/intelligence/assets', '/api/v2/intelligence/assets/ASSET00', '/api/v2/intelligence/assets/ASSET00/news', '/api/v2/intelligence/assets/ASSET00/events', '/api/market-summary'].includes(c.path)), JSON.stringify(calls));
    assert.deepEqual(errors, []);
    console.log('PASS: shared card defaults/focus; 110 assets, search/name matching, scores/zero/missing, filters, pagination, safe evidence/modal, shell navigation, desktop/mobile, expired/mismatched/partial/unavailable feeds, GET-only and no search requests.');
  } finally { await browser.close(); server.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
