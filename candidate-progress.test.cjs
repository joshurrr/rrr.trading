const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const symbols = ['BTW','ZRO','NMR','MOVR','NEAR','SAND','ORCA','MET','XMR','RAYDIUM'];
const now = Date.now();
const iso = n => new Date(now - n * 1000).toISOString();
const runId = 'v2-paper-fixture-20261008';
const timeframes = ['15m','1h','4h'];
const botConfig = {
  short: { timeframe: '15m', route: '/api/demos/short/status', strategy: 'Short Term 15m' },
  medium: { timeframe: '1h', route: '/status', strategy: 'Medium 1hr' },
  long: { timeframe: '4h', route: '/api/demos/long/status', strategy: 'Long Term 4hr' }
};

function decisionFor(symbol) {
  const i = symbols.indexOf(symbol), selected = i === 1 ? '1h' : null;
  const status = i === 2 ? 'BLOCKED' : i === 3 ? 'STALE' : selected ? 'GO' : 'NO_EDGE';
  const available = i !== 3;
  return {
    id: 500 + i, decision_time: iso(i === 3 ? 7200 : 20 + i), decision: i === 2 ? 'BLOCKED' : selected ? 'GO' : i === 3 ? 'INSUFFICIENT_DATA' : 'NO_GO',
    direction: selected ? 'LONG' : i === 2 ? 'UNKNOWN' : 'NEUTRAL', selected_timeframe: selected,
    reason_summary: i === 2 ? 'CROSS_BOT_POSITIONS_UNVERIFIED' : selected ? 'CURRENT_SELECTION' : i === 3 ? 'ALL_TECHNICAL_TIMEFRAMES_UNAVAILABLE' : 'NO_TIMEFRAME_CLEARS_THRESHOLDS',
    veto_reason: i === 2 ? 'CROSS_BOT_POSITIONS_UNVERIFIED' : null, available, freshness: available ? 'FRESH' : 'STALE',
    saved_decision: available ? null : 'INSUFFICIENT_DATA', saved_selected_timeframe: null, expired_evidence: available ? [] : ['positions'],
    evidence: { flags: i === 2 ? ['CROSS_BOT_POSITIONS_UNVERIFIED'] : [] },
    timeframe_assessments: Object.fromEntries(timeframes.map(tf => [tf, {
      timeframe: tf, direction: i === 0 ? 'LONG' : 'NEUTRAL', status: !available ? 'STALE' : status,
      reason_summary: !available ? 'ALL_TECHNICAL_TIMEFRAMES_UNAVAILABLE' : i === 0 ? 'NO_NONTECHNICAL_DIRECTION_CONFIRMATION' : 'NO_CLEAR_DIRECTION',
      selected: tf === selected, created_at: iso(i === 3 ? 7200 : 20 + i),
      evidence: { flags: !available ? ['ALL_TECHNICAL_TIMEFRAMES_UNAVAILABLE'] : ['NO_NONTECHNICAL_DIRECTION_CONFIRMATION'], freshness: { technical_at: iso(i === 3 ? 7300 : 180 + i) } }
    }]))
  };
}

function assetFor(symbol) {
  const i = symbols.indexOf(symbol), d = decisionFor(symbol);
  return {
    api_version: '2.6.0-phase8', schema_version: 7, served_at: iso(1),
    universe_sync: { fresh: true, synced_at: iso(4), valid_until: iso(-600), selected_symbols: symbols },
    asset: { symbol, name: symbol }, decision: d, timeframe_assessments: d.timeframe_assessments,
    sizing: { available: false, freshness: 'UNAVAILABLE', reason: null, sizing_version: 'position-sizing-v1', risk_version: 'portfolio-risk-v1' },
    execution: {
      health: { mode: 'PAPER', status: 'available', enabled: true, stale: false, run_id: runId, last_run: iso(2), started_at: iso(3600), versions: { execution_version: 'paper-execution-v1' } },
      latest_execution: i === 1 ? { status: 'OPEN', timeframe: '1h', direction: 'LONG' } : i === 4 ? { status: 'CLAIMED' } : null,
      active_position: i === 1, reservation_pending: i === 4
    }
  };
}

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  const file = path.join(__dirname, pathname.endsWith('/') ? pathname + 'index.html' : pathname);
  if (!file.startsWith(__dirname + path.sep)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end();
    res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(data);
  });
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage(), errors = [];
    let failAssetDetails = false;
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://stream.radiorrr.com/**', route => route.abort());
    await page.route('https://api.rrr.trading/**', route => {
      const url = new URL(route.request().url()), p = url.pathname;
      if (p.endsWith('/opportunities')) return route.fulfill({ json: { api_version: '2.6.0-phase8', universe_sync: { fresh: true, synced_at: iso(4), valid_until: iso(-600), selected_symbols: symbols }, opportunities: [] } });
      if (/\/assets\/[^/]+$/.test(p)) return failAssetDetails ? route.fulfill({ status: 503 }) : route.fulfill({ json: assetFor(decodeURIComponent(p.split('/').pop())) });
      if (p.endsWith('/execution/health')) return route.fulfill({ json: { mode: 'PAPER', status: 'available', enabled: true, stale: false, run_id: runId, started_at: iso(3600), last_run: iso(2), versions: { learning_version: 'learning-v1-baseline', decision_version: 'decision-engine-v1', sizing_version: 'position-sizing-v1', execution_version: 'paper-execution-v1' } } });
      if (p.endsWith('/execution/performance')) return route.fulfill({ json: { available: true, run_id: runId, starting_balance: 10000, realized_pnl: 0, open_pnl: 0, win_rate: null, average_trade: null, total_pnl: 0, return_pct: 0, wins: 0, losses: 0, trade_count: 0, max_drawdown_pct: 0, completed_trades: [] } });
      if (p.endsWith('/execution/records')) return route.fulfill({ json: { run_id: runId, records: [] } });
      if (p.endsWith('/status') || p === '/status') {
        const key = p.includes('/short/') ? 'short' : p.includes('/long/') ? 'long' : 'medium', cfg = botConfig[key];
        return route.fulfill({ json: { ok: true, generated_at: Date.now()/1000, demo: key === 'medium' ? undefined : key, bot: { timeframe: cfg.timeframe, mode: 'PAPER', state: 'RUNNING', strategy: cfg.strategy, exchange: 'bybit', stake_currency: 'USDT', trading_mode: 'futures', margin_mode: 'isolated', short_allowed: true, pairs: symbols.map(s => `${s}/USDT:USDT`), started_at: (now-3600000)/1000 }, portfolio: { profit_closed_abs: -999, profit_all_abs: -999, profit_all_pct: -9.99, winning_trades: 99, losing_trades: 1, closed_trades: 100, max_drawdown: .5, starting_balance: 1000 }, open_trades: [], history: [] } });
      }
      if (p.endsWith('/decision-flow')) {
        const key = p.includes('/short/') ? 'short' : p.includes('/long/') ? 'long' : 'medium', cfg = botConfig[key];
        return route.fulfill({ json: { ok: true, generated_at: Date.now()/1000, bot: key, timeframe: cfg.timeframe, market_scan: [], technical: { pair: 'BTC/USDT:USDT', timestamp: iso(180), state: 'NO SIGNAL', values: {} }, final_decision: { state: 'NO SIGNAL', timestamp: iso(180) }, history_state: 'AVAILABLE', recent_decisions: [] } });
      }
      if (p === '/api/trading-context') return route.fulfill({ json: { mode: 'observation_only', fresh: true, generated_at: new Date().toISOString(), crypto: { available: true, fresh: true, regime: 'neutral', confidence: 0 } } });
      return route.fulfill({ status: 404, json: { error: 'fixture unavailable' } });
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    await page.goto(base + '/');
    await page.waitForFunction(() => document.querySelectorAll('#candidate-progress-list .candidate-row').length === 10 && document.querySelector('[data-home-bot=short] dl')?.textContent.includes('v2-paper-fixture'));
    assert.match(await page.locator('[data-home-bot=short]').innerText(), /Realized P\/L\s+0\.00 USDT/);
    assert.match(await page.locator('[data-home-bot=short]').innerText(), /No completed trades yet/);
    assert.doesNotMatch(await page.locator('[data-home-bot=short]').innerText(), /Loading current-run evidence|V2 performance unavailable/);
    assert.doesNotMatch(await page.locator('#homepage-bots').innerText(), /-999/);
    assert.match(await page.locator('#candidate-progress-list').innerText(), /No direction selected/);
    assert.match(await page.locator('#candidate-progress-list').innerText(), /Stale · saved assessment only/);

    for (const [folder, tf, assigned] of [['15minbot','15m','0 assigned'],['1hrbot','1h','1 assigned'],['4hrbot','4h','0 assigned']]) {
      await page.goto(`${base}/demo/${folder}/`);
      await page.waitForFunction(() => document.querySelector('#what-happening-now [data-candidate-assigned]')?.textContent);
      assert.equal(await page.locator('#what-happening-now h2').innerText(), "What's happening now?");
      assert.equal(await page.locator('.header-hero-title').innerText(), { '15m': '15 min bot', '1h': '1 hour bot', '4h': '4 hour bot' }[tf]);
      assert.doesNotMatch(await page.locator('.header-hero-title').innerText(), /currently trading/i);
      assert.match(await page.locator('[data-candidate-assigned]').innerText(), new RegExp(assigned));
      assert.match(await page.locator('#what-happening-now').innerText(), /Pending orders\s+Unavailable · no reliable/i);
      assert.match(await page.locator('#what-happening-now').innerText(), /Open bot positions\s+0/i);
      assert.match(await page.locator('#v2-paper').innerText(), /V2 realized P\/L: 0 USDT/);
      assert.match(await page.locator('#v2-paper').innerText(), /Win rate: No completed trades yet/);
      if (tf === '1h') {
        await page.locator('#what-happening-now tbody tr').filter({ hasText: 'ZRO' }).locator('details summary').click();
        assert.match(await page.locator('#what-happening-now tbody tr').filter({ hasText: 'ZRO' }).innerText(), /Position filled\/open/);
        await page.locator('#what-happening-now tbody tr').filter({ hasText: 'NEAR' }).locator('details summary').click();
        assert.match(await page.locator('#what-happening-now tbody tr').filter({ hasText: 'NEAR' }).innerText(), /Reservation pending/);
      }
      if (tf === '4h') assert.equal(await page.locator('body.v2-paper-owned #flow').isVisible(), false);
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.locator('#what-happening-now').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${folder} panel overflow at ${width}`);
      }
    }
    failAssetDetails = true;
    await page.goto(`${base}/demo/1hrbot/`);
    await page.waitForFunction(() => document.querySelector('#what-happening-now [data-candidate-empty]')?.textContent.includes('No current timeframe evaluation records'));
    assert.match(await page.locator('[data-candidate-assigned]').innerText(), /Assignment count unavailable/);
    assert.match(await page.locator('#what-happening-now').innerText(), /No current timeframe evaluation records are supplied/);
    assert.deepEqual(errors, []);
    console.log('PASS: selected assets, current-run performance, stale/no-direction states, timeframe assignment vs assessment, order/fill separation, all bot panels and responsive widths.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
