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
  const i = symbols.indexOf(symbol), selected = i === 1 ? '1h' : i === 6 ? '4h' : null;
  const status = i === 2 ? 'BLOCKED' : i === 3 ? 'STALE' : selected ? 'GO' : 'NO_EDGE';
  const available = i !== 3;
  return {
    id: 500 + i, decision_time: iso(i === 3 ? 7200 : 20 + i), decision: i === 2 ? 'BLOCKED' : selected ? 'GO' : i === 3 ? 'INSUFFICIENT_DATA' : 'NO_GO',
    direction: selected ? 'LONG' : i === 2 ? 'UNKNOWN' : 'NEUTRAL', selected_timeframe: selected,
    reason_summary: i === 2 ? 'CROSS_BOT_POSITIONS_UNVERIFIED' : selected ? 'CURRENT_SELECTION' : i === 3 ? 'ALL_TECHNICAL_TIMEFRAMES_UNAVAILABLE' : 'NO_TIMEFRAME_CLEARS_THRESHOLDS',
    veto_reason: i === 2 ? 'CROSS_BOT_POSITIONS_UNVERIFIED' : null, available, freshness: available ? 'FRESH' : 'STALE',
    saved_decision: available ? null : 'INSUFFICIENT_DATA', saved_selected_timeframe: i === 3 ? '15m' : null, expired_evidence: available ? [] : ['positions'],
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
      latest_execution: i === 1 ? { status: 'OPEN', timeframe: '1h', direction: 'LONG' } : i === 4 ? { status: 'CLAIMED', timeframe: '4h' } : null,
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
    let failAssetDetails = false, failUniverse = false, failStatus = false, staleAssigned = false, shortAssigned = false, paused = false, positionScenario = null, positionFresh = true, positionOpen = true, positionSelected = false;
    const writes = [];
    page.on('request', r => { if (r.url().startsWith('https://api.rrr.trading') && r.method() !== 'GET') writes.push(r.method()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://stream.radiorrr.com/**', route => route.abort());
    await page.route('https://api.rrr.trading/**', route => {
      const url = new URL(route.request().url()), p = url.pathname;
      if (p.endsWith('/opportunities') && failUniverse) return route.fulfill({status:503});
      if (p.endsWith('/opportunities')) return route.fulfill({ json: { api_version: '2.6.0-phase8', universe_sync: { fresh: true, synced_at: iso(4), valid_until: iso(-600), selected_symbols: symbols }, opportunities: [] } });
      if (/\/assets\/[^/]+$/.test(p)) {
        const asset = assetFor(decodeURIComponent(p.split('/').pop()));
        if (shortAssigned && asset.asset.symbol === 'BTW') Object.assign(asset.decision, {decision:'GO',direction:'SHORT',selected_timeframe:'15m'});
        if (staleAssigned && asset.asset.symbol === 'ZRO') Object.assign(asset.decision, {available:false, freshness:'STALE', saved_selected_timeframe:'1h', selected_timeframe:null, reason_summary:'STALE'});
        if (positionScenario && asset.asset.symbol === 'BTW') {
          Object.assign(asset.decision, {available:positionSelected, freshness:positionSelected?'FRESH':'STALE', decision:positionSelected?'GO':'INSUFFICIENT_DATA', direction:'LONG', selected_timeframe:positionSelected?positionScenario:null, saved_selected_timeframe:positionScenario, reason_summary:'ENTRY_ASSESSMENT_EXPIRED'});
          Object.assign(asset.execution, {latest_execution:{status:'CLAIMED',timeframe:positionScenario,direction:'LONG'},active_position:false,reservation_pending:true});
        }
        return failAssetDetails ? route.fulfill({status:503}) : route.fulfill({json:asset});
      }
      if (p.endsWith('/execution/health')) return route.fulfill({ json: { mode: 'PAPER', status: paused ? 'disabled' : 'available', enabled: !paused, stale: false, run_id: runId, started_at: iso(3600), last_run: iso(2), versions: { learning_version: 'learning-v1-baseline', decision_version: 'decision-engine-v1', sizing_version: 'position-sizing-v1', execution_version: 'paper-execution-v1' } } });
      if (/^\/api\/demos\/(short|medium|long)\/reporting$/.test(p)) return route.fulfill({json:{available:true,run_id:runId,started_at:iso(3600),observed_at:new Date().toISOString(),portfolio:{starting_balance:10000,profit_closed_abs:0,profit_open_abs:10,profit_all_abs:10,profit_all_pct:.1,winning_trades:0,losing_trades:0,closed_trades:0,total_trades:1,win_rate:null,max_drawdown:0},history:[],open_trades:[]}});
      if (p.endsWith('/execution/performance')) return route.fulfill({ json: { available: true, run_id: runId, starting_balance: 10000, realized_pnl: 0, open_pnl: 0, win_rate: null, average_trade: null, total_pnl: 0, return_pct: 0, wins: 0, losses: 0, trade_count: 0, max_drawdown_pct: 0, completed_trades: [] } });
      if (p.endsWith('/execution/records')) return route.fulfill({ json: { run_id: runId, records: [] } });
      if (p.endsWith('/status') || p === '/status') {
        if (failStatus) return route.fulfill({status:503});
        const key = p.includes('/short/') ? 'short' : p.includes('/long/') ? 'long' : 'medium', cfg = botConfig[key];
        return route.fulfill({ json: { ok: true, generated_at: Date.now()/1000 - (positionFresh ? 0 : 120), demo: key === 'medium' ? undefined : key, bot: { timeframe: cfg.timeframe, mode: 'PAPER', state: 'RUNNING', strategy: cfg.strategy, exchange: 'bybit', stake_currency: 'USDT', trading_mode: 'futures', margin_mode: 'isolated', short_allowed: true, pairs: symbols.map(s => `${s}/USDT:USDT`), started_at: (now-3600000)/1000 }, portfolio: { profit_closed_abs: -999, profit_all_abs: -999, profit_all_pct: -9.99, winning_trades: 99, losing_trades: 1, closed_trades: 100, max_drawdown: .5, starting_balance: 1000 }, open_trades: [{id:999,pair:positionScenario && positionOpen?'BTW/USDT:USDT':'DOGE/USDT:USDT',direction:'LONG',open_rate:.1,current_rate:.11,stake_amount:100,profit_abs:10,profit_pct:10,open_date:iso(3600)}], history: [] } });
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

    for (const [folder, tf, assigned] of [['15minbot','15m','0 assigned'],['1hrbot','1h','1 assigned'],['4hrbot','4h','1 assigned']]) {
      await page.goto(`${base}/demo/${folder}/`);
      await page.waitForFunction(() => document.querySelector('#what-happening-now [data-candidate-assigned]')?.textContent);
      assert.equal(await page.locator('#what-happening-now h2').innerText(), "What's happening now?");
      assert.equal(await page.locator('.header-hero-title').innerText(), { '15m': '15 min bot', '1h': '1 hour bot', '4h': '4 hour bot' }[tf]);
      assert.doesNotMatch(await page.locator('.header-hero-title').innerText(), /currently trading/i);
      assert.match(await page.locator('[data-candidate-assigned]').innerText(), new RegExp(assigned));
      assert.equal(await page.locator('#bot-current-status>div').count(), 6);
      assert.match(await page.locator('#bot-current-status').innerText(), /OPEN POSITIONS\s+1/);
      assert.equal(await page.locator('#shared-assessment-diagnostics').getAttribute('open'), null);
      assert.equal(await page.locator('#what-happening-now h3').innerText(), `${tf} Candidates`);
      assert.equal(await page.locator('#what-happening-now tbody tr').count(), tf === '15m' ? 0 : 1);
      assert.match(await page.locator('#open-trades').innerText(), /DOGE/);
      assert.equal(await page.locator('#open-trades').isVisible(), true);
      const order = await page.evaluate(() => Array.from(document.querySelector('main').children).map(e=>e.id || e.className));
      assert.ok(order.indexOf('what-happening-now') < order.findIndex(s=>s.includes('open-trades-section')));
      assert.ok(order.findIndex(s=>s.includes('completed-trades-section')) < order.indexOf('shared-assessment-diagnostics'));
      if (tf === '15m') {
        assert.match(await page.locator('[data-candidate-empty]').innerText(), /No assets currently assigned to the 15m bot/);
        assert.equal(await page.locator('.candidate-desktop-table').isVisible(), false);
        assert.match(await page.locator('.candidate-safety').innerText(), /MOVR assessment stale/);
        assert.doesNotMatch(await page.locator('#what-happening-now tbody').innerText(), /ZRO|ORCA/);
      } else {
        assert.equal(await page.locator('#what-happening-now tbody tr td:first-child').innerText(), tf === '1h' ? 'ZRO' : 'ORCA');
        await page.setViewportSize({width:1440,height:900});
        await page.locator('#what-happening-now tbody summary').click();
        assert.match(await page.locator('#what-happening-now tbody').innerText(), /Recorded checks|Assessment reason/);
        if (tf === '1h') assert.match(await page.locator('#what-happening-now tbody').innerText(), /Position filled\/open/);
        if (tf === '4h') assert.doesNotMatch(await page.locator('#what-happening-now tbody').innerText(), /Position filled\/open/);
      }
      await page.locator('#shared-assessment-diagnostics>summary').click();
      assert.equal(await page.locator('[data-shared-assessments]>.candidate-row').count(),10);
      assert.match(await page.locator('#shared-assessment-diagnostics').innerText(), /Pending-order count unavailable/);
      assert.equal(await page.locator('#shared-assessment-diagnostics a').getAttribute('href'), '/#live-candidate-progress');
      const saved = page.locator('[data-shared-assessments]>.candidate-row').filter({hasText:'MOVR'});
      await saved.locator('summary').click();
      assert.match(await saved.innerText(), /Stale|saved/);
      await page.locator('#shared-assessment-diagnostics>summary').click();
      assert.match(await page.locator('#v2-paper').textContent(), /Native Freqtrade trades opened within this run/);
      assert.doesNotMatch(await page.locator('#v2-paper').textContent(), /Starting balance:|Total P\/L:|Wins\/losses:|V2 realized P\/L:/);
      if (tf === '4h') assert.equal(await page.locator('body.v2-paper-owned #flow').isVisible(), false);
      for (const width of [320, 375, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        assert.ok(await page.locator('#what-happening-now').evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${folder} panel overflow at ${width}`);
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth + 1), `${folder} page overflow at ${width}`);
        if (width === 375 || width === 1440) await page.screenshot({path:`.runtime/bot-cleanup/${folder}-${width}.png`,fullPage:true});
      }
    }
    for (const [folder, tf] of [['15minbot','15m'],['1hrbot','1h'],['4hrbot','4h']]) {
      positionScenario=tf; positionOpen=true; positionFresh=true; positionSelected=false;
      await page.goto(`${base}/demo/${folder}/`);
      await page.waitForFunction(()=>document.querySelector('.candidate-position-note')?.textContent.includes('BTW'));
      assert.doesNotMatch(await page.locator('.candidate-safety').innerText(), /BTW assessment stale/);
      assert.match(await page.locator('.candidate-position-note').innerText(), /open position.*Existing exit rules/);
      assert.equal(await page.locator('.candidate-position-note a').getAttribute('href'),'#exit-panel');
      assert.match(await page.locator('#open-trades').innerText(), /BTW/);
      await page.locator('#shared-assessment-diagnostics>summary').click();
      const historical=page.locator('[data-shared-assessments]>.candidate-row').filter({hasText:'BTW'});
      assert.match(await historical.innerText(), /STALE|Stale/);
      await page.locator('#shared-assessment-diagnostics>summary').click();
      for (const width of [320,375,768,1440]) {
        await page.setViewportSize({width,height:900});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${folder} open-position overflow ${width}`);
        if(width===375||width===1440)await page.screenshot({path:`.runtime/open-position-monitoring/${folder}-${width}.png`,fullPage:true});
      }
      positionSelected=true;
      await page.reload();
      await page.waitForFunction(()=>document.querySelector('.candidate-position-note')?.textContent.includes('BTW'));
      assert.doesNotMatch(await page.locator('#what-happening-now tbody').innerText(), /BTW/);
      assert.equal(await page.locator('[data-candidate-assigned]').innerText(),`${tf==='15m'?0:1} assigned to ${tf}`);
      positionSelected=false; positionFresh=false;
      await page.reload();
      await page.waitForFunction(()=>document.querySelector('.candidate-safety')?.textContent.includes('Current position observations unavailable or stale'));
      assert.match(await page.locator('.candidate-safety').innerText(),/BTW assessment stale/);
      assert.equal(await page.locator('.candidate-position-note').count(),0);
      positionFresh=true; positionOpen=false;
      await page.reload();
      await page.waitForFunction(()=>document.querySelector('.candidate-safety')?.textContent.includes('BTW assessment stale'));
      assert.doesNotMatch(await page.locator('.candidate-position-note').innerText(), /BTW/);
      assert.match(await page.locator('.candidate-safety').innerText(),/no current entry approval/);
    }
    positionScenario=null;
    shortAssigned = true;
    await page.goto(`${base}/demo/15minbot/`);
    await page.waitForFunction(()=>document.querySelector('#what-happening-now tbody tr')?.textContent.includes('BTW'));
    assert.equal(await page.locator('#what-happening-now tbody tr').count(),1);
    assert.match(await page.locator('#what-happening-now tbody').innerText(),/SHORT/);
    shortAssigned = false;
    staleAssigned = true;
    await page.goto(`${base}/demo/1hrbot/`);
    await page.waitForFunction(()=>document.querySelector('.candidate-safety')?.textContent.includes('ZRO assessment stale'));
    assert.equal(await page.locator('#what-happening-now tbody tr').count(),0);
    assert.match(await page.locator('.candidate-safety').innerText(), /no current entry approval/);
    assert.match(await page.locator('#open-trades').innerText(), /DOGE/);
    staleAssigned = false;
    failStatus = true;
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#bot-current-status')?.textContent.includes('Unavailable or stale'));
    assert.equal(await page.locator('#what-happening-now tbody tr').count(),1);
    failStatus = false; failAssetDetails = true;
    await page.reload();
    await page.waitForFunction(() => document.querySelector('[data-candidate-empty]')?.textContent.includes('cannot be fully verified'));
    assert.match(await page.locator('[data-candidate-assigned]').innerText(), /complete count unavailable/);
    assert.equal(await page.locator('[data-shared-assessments]>.candidate-row').count(),10);
    assert.equal(await page.locator('#what-happening-now tbody tr').count(),0);
    paused = true; failAssetDetails = false;
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('#what-happening-now')?.textContent.includes('Paper entries paused / blocked'));
    assert.match(await page.locator('#bot-current-status').innerText(), /PAPER paused/);
    paused = false; failUniverse = true;
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('[data-candidate-assigned]')?.textContent.includes('opportunity feed failed'));
    assert.match(await page.locator('[data-candidate-empty]').innerText(), /unavailable/);
    assert.deepEqual(writes, []);
    assert.deepEqual(errors, []);
    console.log('PASS: timeframe-only candidates, empty/partial/failure states, scoped stale warnings, all shared assessments, recorded checks, fresh open positions separated from entry warnings, pending/stale-position safeguards, historical assessments, independent out-of-universe positions, six cards/hierarchy, GET-only requests, homepage preservation and all bot widths.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
