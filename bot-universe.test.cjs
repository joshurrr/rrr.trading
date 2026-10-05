const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const server = http.createServer((req, res) => {
    let file = path.join(__dirname, new URL(req.url, 'http://localhost').pathname);
    if (req.url.split('?')[0].endsWith('/')) file = path.join(file, 'index.html');
    fs.readFile(file, (error, data) => {
      if (error) return res.writeHead(404).end();
      res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
      res.end(data);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({headless:true, channel:'msedge'});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let data, failure = false;
    const fixture = () => ({
      schema_version:1, status:'ok', universe_version:'verified-test', entry_eligible:true,
      generated_at:new Date(Date.now() - 60000).toISOString(), valid_until:new Date(Date.now() + 600000).toISOString(),
      assets:'NIL ICP RLC HYPE ZRO AERO FLUID AAVE NEAR TIA'.split(' ').map((symbol, index) => ({
        symbol, pair:symbol + '/USDT:USDT', rank:index + 1, opportunity_score:80 - index,
        reason:'Verified opportunity evidence', data_confidence:.8, approved_for_new_entries:true
      })),
      bot_sync:Object.fromEntries(['short', 'medium', 'long'].map(key => [key, {
        status:'current', loaded:10, expected:10, universe_version:'verified-test', checked_at:new Date().toISOString()
      }]))
    });
    await page.route('https://stream.radiorrr.com/**', route => route.abort());
    await page.route('https://api.rrr.trading/**', route => new URL(route.request().url()).pathname === '/api/trading-universe'
      ? failure ? route.fulfill({status:503}) : route.fulfill({json:data})
      : route.fulfill({status:503}));
    for (const [bot, folder, timeframe] of [['short','15minbot','15m'], ['medium','1hrbot','1h'], ['long','4hrbot','4h']]) {
      data = fixture();
      await page.goto(`http://127.0.0.1:${server.address().port}/demo/${folder}/`);
      await page.waitForFunction(() => document.querySelectorAll('.bot-universe-card').length === 10);
      assert.match(await page.locator('#bot-universe-status').innerText(), /10 markets loaded/);
      if (bot === 'short') {
        assert.equal(await page.locator('#scan #bot-trading-universe').count(), 1);
        await page.evaluate(() => renderAssetBranches({market_scan:[{pair:'NIL/USDT:USDT',state:'NO SIGNAL',timestamp:new Date().toISOString()}]}));
        assert.equal(await page.locator('#scan .scan-tile').count(), 0);
        assert.equal(await page.locator('#scan .bot-universe-card').count(), 10);
      }
      assert.match(await page.locator('.bot-universe-fit').first().innerText(), /Opportunity: 80 \/ 100/);
      assert.equal(await page.locator('.bot-universe-state').first().innerText(), 'LOADED');
      assert.doesNotMatch(await page.locator('#bot-universe-assets').innerText(), /% fit|No verified assets/);
      for (const width of [320,375,768,1440]) {
        await page.setViewportSize({width,height:900});
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${folder} overflow at ${width}`);
      }
      for (const mutate of [
        value => { value.bot_sync[bot].universe_version = 'older'; },
        value => { value.bot_sync[bot].checked_at = new Date(Date.now() - 180000).toISOString(); },
        value => { delete value.bot_sync; }
      ]) {
        data = fixture(); mutate(data); await page.evaluate(() => refreshBotTradingUniverse());
        assert.match(await page.locator('#bot-universe-status').innerText(), /loading unverified/);
        assert.equal(await page.locator('.bot-universe-card').count(), 10);
        assert.equal(await page.locator('.bot-universe-state').first().innerText(), 'SELECTED');
      }
      data = fixture(); data.valid_until = new Date(Date.now() - 30000).toISOString();
      await page.evaluate(() => refreshBotTradingUniverse());
      assert.match(await page.locator('#bot-universe-status').innerText(), /STALE.*new entries blocked/);
      assert.equal(await page.locator('.bot-universe-state').first().innerText(), 'SELECTED');
      data = fixture(); data.status = 'stale'; await page.evaluate(() => refreshBotTradingUniverse());
      assert.match(await page.locator('#bot-universe-status').innerText(), /STALE.*saved lineup retained/);
      data = fixture();
      data.assets.forEach((asset, index) => { asset.timeframes = {[timeframe]:{eligible:index < 2, score:65, reason:'Backend timeframe evidence'}}; });
      await page.evaluate(() => refreshBotTradingUniverse());
      assert.equal(await page.locator('.bot-universe-card').count(), 2);
      assert.match(await page.locator('#bot-universe-status').innerText(), /2 markets allocated/);
      assert.match(await page.locator('.bot-universe-fit').first().innerText(), /Timeframe fit: 65 \/ 100/);
      data.assets.forEach(asset => { asset.timeframes[timeframe].eligible = false; });
      await page.evaluate(() => refreshBotTradingUniverse());
      assert.match(await page.locator('#bot-universe-assets').innerText(), /No verified assets/);
      delete data.assets[0].timeframes;
      await page.evaluate(() => refreshBotTradingUniverse());
      assert.equal(await page.locator('.bot-universe-card').count(), 10, 'Incomplete allocation metadata must not imply zero allocation');
      data = fixture(); data.assets[1].pair = data.assets[0].pair;
      await page.evaluate(() => refreshBotTradingUniverse());
      assert.match(await page.locator('#bot-universe-status').innerText(), /UNAVAILABLE/);
      assert.equal(await page.locator('.bot-universe-card').count(), 0);
      failure = true; await page.evaluate(() => refreshBotTradingUniverse());
      assert.match(await page.locator('#bot-universe-status').innerText(), /UNAVAILABLE/);
      failure = false;
    }
    assert.deepEqual(errors, []);
    console.log('PASS: all three bot pages display verified loaded markets without allocation fields, preserve explicit allocations, distinguish opportunity from timeframe fit, and handle stale/mismatched/missing loading, expired/malformed/unavailable payloads and desktop/mobile layouts.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
