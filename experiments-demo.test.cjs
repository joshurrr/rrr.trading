const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'msedge'});
  const page = await browser.newPage();
  const errors = [], calls = [];
  page.on('pageerror', error => errors.push(error.message));
  let state = 'fresh';
  await page.route('https://stream.radiorrr.com/**', r => r.abort());
  await page.route('https://api.rrr.trading/**', r => {
    if (!r.request().url().endsWith('/api/experiments/summary')) return r.fulfill({status: 503});
    calls.push(r.request());
    if (state === 'outage') return r.fulfill({status: 503});
    return r.fulfill({json: {ok: true, mode: 'shadow', generated_at: new Date(Date.now() - (state === 'stale' ? 300000 : 0)).toISOString(),
      champion: {version: '1.0'}, challenger: state === 'ended' ? null : {version: '1.1'}, effective_at: new Date().toISOString(),
      experiment: {name: '<script>bad()</script> baseline', status: state === 'ended' ? 'completed' : 'running'},
      comparison_policy_ids: {champion_policy_id: 'champion-v1.0', challenger_policy_id: 'challenger-v1.1'},
      metrics: {completed_trade_outcomes: state === 'empty' ? 0 : 20, minimum_sample: 100, sample_state: 'COLLECTING',
        decision_agreement_rate: state === 'empty' ? null : 0.95, losing_trades_avoided: 0, winning_trades_missed: 1,
        net_outcome_delta: state === 'empty' ? null : 12, champion: {profit_factor: 1.2}, challenger: {profit_factor: null}, drawdown_comparison: null}}});
  });
  for (const url of ['/demo/', '/demo/short/', '/demo/long/']) {
    for (state of ['fresh', 'empty', 'ended', 'stale', 'outage']) {
      await page.goto('http://127.0.0.1:8765' + url);
      await page.waitForFunction(() => !document.querySelector('[data-policy-status]').textContent.includes('Awaiting'));
      await page.locator('#policy-comparison summary').click();
      const panel = page.locator('#policy-comparison');
      const text = await panel.innerText();
      assert.equal(await panel.locator('button, input, script').count(), 0);
      if (state === 'stale' || state === 'outage') {
        assert.match(text, /unavailable/i); assert(!text.includes('95.0%'));
      } else {
        assert.match(text, /v1.0/); assert.match(text, /Unavailable/);
        assert.match(text, /<script>bad\(\)<\/script>/);
        if (state === 'empty') assert(!text.includes('95.0%'));
        if (state === 'ended') assert.match(text, /None/);
      }
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({width, height: 1000});
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Page overflow ' + width);
        if (state === 'fresh') await panel.screenshot({path: path.join(os.tmpdir(), `phase5b-comparison-${url.includes('long') ? 'long' : url.includes('short') ? 'short' : 'medium'}-${width}.png`)});
      }
    }
  }
  assert(calls.length > 0 && calls.every(r => r.method() === 'GET'));
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: three demo pages; 320/768/1440px; fresh/empty/ended/stale/outage; GET-only; escaped text; no controls');
})().catch(error => {console.error(error); process.exit(1);});
