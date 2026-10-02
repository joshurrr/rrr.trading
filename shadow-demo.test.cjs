const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
(async () => {
  const browser = await chromium.launch({headless: true, channel: 'msedge'});
  const page = await browser.newPage();
  await page.clock.install();
  const errors = [], calls = [];
  page.on('pageerror', e => errors.push(e.message));
  let state = 'fresh';
  await page.route('https://stream.radiorrr.com/**', r => r.abort());
  await page.route('https://api.rrr.trading/**', r => {
    const url = new URL(r.request().url());
    if (!url.pathname.startsWith('/api/shadow-decisions')) return r.fulfill({status: 503});
    calls.push(url);
    if (state === 'outage') return r.fulfill({status: 503});
    const bot = url.searchParams.get('bot');
    const dataBot = state === 'wrong' ? (bot === 'short' ? 'medium' : 'short') : bot;
    const result = {ok: true, mode: 'shadow'};
    if (url.pathname.endsWith('/health')) {
      result.worker_running = true;
      result.bots = Object.fromEntries(['medium','short','long'].map(b => [b, {status: state === 'stale' ? 'stale' : 'healthy', last_poll_at: new Date(Date.now() - (state === 'stale' ? 300000 : 0)).toISOString()}]));
    } else if (url.pathname.endsWith('/summary')) {
      Object.assign(result, {filters: {bot: dataBot}, signals: state === 'empty' ? 0 : 34,
        shadow: {allowed: 19, rejected: 15, vetoed: 0},
        estimated_filter_effect: {completed_trades: state === 'partial' || state === 'empty' ? 0 : 3, avoided_loss_abs: state === 'partial' ? null : 42, missed_profit_abs: 11, net_effect_abs: 31}});
    } else {
      result.decisions = state === 'empty' ? [] : [{bot: dataBot, asset: 'SOL', direction: 'long', shadow_decision: 'REJECT', shadow_confidence: 31,
        signal_at: new Date().toISOString(), reasons: ['Crypto regime is strongly bearish', 'BTC market anchor is strongly bearish', '<script>bad()</script>']}];
    }
    return r.fulfill({json: result});
  });
  for (const [url, bot] of [['/demo/','medium'], ['/demo/short/','short'], ['/demo/long/','long']]) {
    await page.clock.setSystemTime(new Date());
    calls.length = 0;
    state = 'fresh';
    await page.goto('http://127.0.0.1:8765' + url);
    const panel = page.locator('#shadow-decisions');
    await page.waitForFunction(() => document.querySelector('[data-shadow-status]').textContent.includes('Observer healthy'));
    assert.equal(await panel.evaluate(e => e.open), false);
    await panel.locator('summary').click();
    const text = await panel.innerText();
    assert.match(text, /Observation only .* does not affect trades/);
    assert.match(text, /SOL LONG/);
    assert.match(text, /31 \/ 100/);
    assert.match(text, /\+31\.00 USDT/);
    assert.match(text, /<script>bad\(\)<\/script>/);
    assert.equal(await panel.locator('script').count(), 0);
    assert(calls.every(u => u.pathname.endsWith('/health') || u.searchParams.get('bot') === bot));
    assert.equal(calls.find(u => u.pathname === '/api/shadow-decisions').searchParams.get('limit'), '1');
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({width, height: 1000});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Overflow ' + url + width);
      await panel.screenshot({path: path.join(os.tmpdir(), `phase3-shadow-${bot}-${width}.png`)});
    }
    for (state of ['empty','partial','stale','wrong','outage']) {
      await page.reload();
      await page.locator('#shadow-decisions summary').click();
      if (state === 'wrong' || state === 'outage') {
        await page.waitForFunction(() => document.querySelector('[data-shadow-status]').textContent === 'Shadow endpoint unavailable');
        assert(!(await panel.innerText()).includes('31 / 100'));
      } else {
        await page.waitForFunction(() => document.querySelector('[data-shadow-status]').textContent.includes('Observer'));
        const text = await panel.innerText();
        if (state === 'empty') assert.match(text, /No shadow decisions recorded/);
        if (state === 'partial' || state === 'empty') {
          assert.match(text, /outcomes unavailable/);
          assert(!text.includes('+31.00 USDT'));
        }
        if (state === 'stale') assert.match(text, /Observer stale \/ unavailable or degraded/);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    state = 'fresh';
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-shadow-status]').textContent.includes('Observer healthy'));
    // Verify that a cached fetch cannot remain fresh indefinitely if polling stalls.
    await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1000));
    await page.route('https://api.rrr.trading/api/shadow-decisions**', () => {});
    await page.clock.runFor(95000);
    assert.match(await page.locator('[data-shadow-status]').textContent(), /unavailable/);
    await page.clock.resume();
    await page.unroute('https://api.rrr.trading/api/shadow-decisions**');
  }
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('PASS: separate bot views, desktop/mobile, empty/partial/stale/outage/recovery, cached expiry and safe reasons');
})().catch(e => {console.error(e); process.exit(1);});

