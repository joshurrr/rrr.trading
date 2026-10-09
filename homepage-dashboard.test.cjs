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
    let performanceMismatch=false, negative=false, zeroPositions=false, staleUniverse=false, slow=false, noCandidates=false;
    const writes = [];
    page.on('request', r => { if (r.url().startsWith('https://api.rrr.trading') && r.method() !== 'GET') writes.push(r.method()); });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('https://stream.radiorrr.com/**', route => route.abort());
    await page.route('https://api.rrr.trading/**', async route => {
      const url = new URL(route.request().url()), p = url.pathname;
      if(slow)await new Promise(resolve=>setTimeout(resolve,1000));
      if(p==='/api/trading-universe')return route.fulfill({json:{schema_version:1,status:staleUniverse?'stale':'ok',generated_at:iso(3),valid_until:iso(-600),universe_version:'fixture',entry_eligible:!staleUniverse,assets:symbols.map((symbol,i)=>({rank:i+1,symbol,pair:symbol+'/USDT:USDT',opportunity_score:80-i,reason:'Recorded comparison evidence',trend:'positive',data_confidence:.8,approved_for_new_entries:true}))}});
      if (p.endsWith('/opportunities') && failUniverse) return route.fulfill({status:503});
      if (p.endsWith('/opportunities')) return route.fulfill({ json: { api_version: '2.6.0-phase8', universe_sync: { fresh: true, synced_at: iso(4), valid_until: iso(-600), selected_symbols: symbols }, opportunities: [] } });
      if (/\/assets\/[^/]+$/.test(p)) {
        const asset = assetFor(decodeURIComponent(p.split('/').pop()));
        if(noCandidates){Object.assign(asset.decision,{available:true,freshness:'FRESH',decision:'NO_GO',selected_timeframe:null,direction:'UNKNOWN'});Object.assign(asset.execution,{active_position:false,reservation_pending:false,latest_execution:{status:'OPEN',timeframe:'1h',direction:'SHORT'}});}
        if (shortAssigned && asset.asset.symbol === 'BTW') Object.assign(asset.decision, {decision:'GO',direction:'SHORT',selected_timeframe:'15m'});
        if (staleAssigned && asset.asset.symbol === 'ZRO') Object.assign(asset.decision, {available:false, freshness:'STALE', saved_selected_timeframe:'1h', selected_timeframe:null, reason_summary:'STALE'});
        if (positionScenario && asset.asset.symbol === 'BTW') {
          Object.assign(asset.decision, {available:positionSelected, freshness:positionSelected?'FRESH':'STALE', decision:positionSelected?'GO':'INSUFFICIENT_DATA', direction:'LONG', selected_timeframe:positionSelected?positionScenario:null, saved_selected_timeframe:positionScenario, reason_summary:'ENTRY_ASSESSMENT_EXPIRED'});
          Object.assign(asset.execution, {latest_execution:{status:'CLAIMED',timeframe:positionScenario,direction:'LONG'},active_position:false,reservation_pending:true});
        }
        return failAssetDetails ? route.fulfill({status:503}) : route.fulfill({json:asset});
      }
      if (p.endsWith('/execution/health')) return route.fulfill({ json: { mode: 'PAPER', status: paused ? 'disabled' : 'available', enabled: !paused, stale: false, run_id: runId, started_at: iso(3600), last_run: iso(2), versions: { learning_version: 'learning-v1-baseline', decision_version: 'decision-engine-v1', sizing_version: 'position-sizing-v1', execution_version: 'paper-execution-v1' } } });
      if (/^\/api\/demos\/(short|medium|long)\/reporting$/.test(p)) return route.fulfill({json:{available:true,run_id:performanceMismatch?'old-run':runId,started_at:iso(3600),observed_at:new Date().toISOString(),portfolio:{starting_balance:10000,profit_closed_abs:negative?-25:0,profit_open_abs:10,profit_all_abs:10,profit_all_pct:.1,winning_trades:0,losing_trades:0,closed_trades:0,total_trades:1,win_rate:null,max_drawdown:0},history:[],open_trades:[]}});
      if (p.endsWith('/execution/performance')) return route.fulfill({ json: { available: true, run_id: performanceMismatch?'old-run':runId, starting_balance: 10000, realized_pnl: negative?-25:0, open_pnl: 0, win_rate: null, average_trade: null, total_pnl: 0, return_pct: 0, wins: 0, losses: 0, trade_count: 0, max_drawdown_pct: 0, completed_trades: [] } });
      if (p.endsWith('/execution/records')) return route.fulfill({ json: { run_id: runId, records: [] } });
      if (p.endsWith('/status') || p === '/status') {
        if (failStatus) return route.fulfill({status:503});
        const key = p.includes('/short/') ? 'short' : p.includes('/long/') ? 'long' : 'medium', cfg = botConfig[key];
        return route.fulfill({ json: { ok: true, generated_at: Date.now()/1000 - (positionFresh ? 0 : 120), demo: key === 'medium' ? undefined : key, bot: { timeframe: cfg.timeframe, mode: 'PAPER', state: 'RUNNING', strategy: cfg.strategy, exchange: 'bybit', stake_currency: 'USDT', trading_mode: 'futures', margin_mode: 'isolated', short_allowed: true, pairs: symbols.map(s => `${s}/USDT:USDT`), started_at: (now-3600000)/1000 }, portfolio: { profit_closed_abs: -999, profit_all_abs: -999, profit_all_pct: -9.99, winning_trades: 99, losing_trades: 1, closed_trades: 100, max_drawdown: .5, starting_balance: 1000 }, open_trades: zeroPositions?[]:[{id:999,pair:positionScenario && positionOpen?'BTW/USDT:USDT':'DOGE/USDT:USDT',direction:'LONG',open_rate:.1,current_rate:.11,stake_amount:100,profit_abs:10,profit_pct:10,open_date:iso(3600)}], history: [] } });
      }
      if (p.endsWith('/decision-flow')) {
        const key = p.includes('/short/') ? 'short' : p.includes('/long/') ? 'long' : 'medium', cfg = botConfig[key];
        return route.fulfill({ json: { ok: true, generated_at: Date.now()/1000, bot: key, timeframe: cfg.timeframe, market_scan: [], technical: { pair: 'BTC/USDT:USDT', timestamp: iso(180), state: 'NO SIGNAL', values: {} }, final_decision: { state: 'NO SIGNAL', timestamp: iso(180) }, history_state: 'AVAILABLE', recent_decisions: [] } });
      }
      if (p === '/api/trading-context') return route.fulfill({ json: { mode: 'observation_only', fresh: true, generated_at: new Date().toISOString(), crypto: { available: true, fresh: true, regime: 'neutral', confidence: 0 } } });
      return route.fulfill({ status: 404, json: { error: 'fixture unavailable' } });
    });

    const base = 'http://127.0.0.1:'+server.address().port;
    await page.goto(base);
    await page.waitForFunction(()=>document.querySelectorAll('.universe-card').length===10&&document.querySelector('#homepage-activity-summary')?.textContent.includes('DOGE'));
    assert.deepEqual(await page.locator('main>section').evaluateAll(es=>es.map(e=>e.id)),['top-opportunities','live-candidate-progress','trading-bots','intelligence-inputs','how-it-works']);
    assert.deepEqual(await page.locator('.dashboard-intelligence-grid>section').evaluateAll(es=>es.map(e=>e.id)),['macro-base','daily-research','traderouter-intelligence']);
    assert.equal(await page.locator('.header-asset').count(),10);
    assert.equal(await page.locator('.paper-card').count(),3);
    assert.equal(await page.locator('#home .dashboard-details[open]').count(),0);
    assert.match(await page.locator('#homepage-activity-summary').innerText(),/DOGE.*Position open/s);
    assert.equal(await page.locator('.activity-row[data-priority="0"]').count(),4);
    assert.match(await page.locator('#homepage-activity-summary').innerText(),/Reservation pending/);
    assert.match(await page.locator('#homepage-activity-summary').innerText(),/Entry blocked/);
    assert.doesNotMatch(await page.locator('#homepage-activity-summary').innerText(),/MOVR/,'stale assignment is excluded');
    assert.equal(await page.locator('#homepage-bots .pnl-metric dd[data-tone=neutral]').count(),3);
    assert.doesNotMatch(await page.locator('#homepage-bots').innerText(),/-999/,'legacy performance excluded');
    const stableCard=await page.locator('.paper-card').first().elementHandle();
    const stableActivity=await page.locator('.activity-row').first().elementHandle();
    await page.evaluate(()=>refreshMarketSummary());
    assert.ok(await stableCard.evaluate(n=>n.isConnected),'routine refresh preserves bot card');
    assert.ok(await stableActivity.evaluate(n=>n.isConnected),'identical activity refresh preserves row');
    await page.locator('#all-candidate-decisions>summary').focus();await page.keyboard.press('Enter');
    assert.equal(await page.locator('#candidate-progress-list .candidate-row').count(),10);
    assert.match(await page.locator('#candidate-progress-list').innerText(),/MOVR.*Stale/s);
    await page.locator('#all-candidate-decisions>summary').click();
    // UTC weekend override and IANA regional hours, including transition weeks.
    assert.deepEqual(await page.evaluate(()=>homepageActiveSessions(new Date('2026-10-10T12:00:00Z'))),[]);
    assert.deepEqual(await page.evaluate(()=>homepageActiveSessions(new Date('2026-01-12T13:30:00Z'))),['EUROPE','US']);
    assert.deepEqual(await page.evaluate(()=>homepageActiveSessions(new Date('2026-07-13T12:30:00Z'))),['EUROPE','US']);
    assert.deepEqual(await page.evaluate(()=>homepageActiveSessions(new Date('2026-03-16T12:30:00Z'))),['EUROPE','US']);
    assert.deepEqual(await page.evaluate(()=>homepageActiveSessions(new Date('2026-10-25T21:30:00Z'))),[]);
    for(const width of [320,375,768,1024,1440]){
      await page.setViewportSize({width,height:900});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow '+width);
      if(width>=1024)assert.equal(await page.locator('.universe-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),5);
      if(width===1440){assert.equal(await page.locator('.paper-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),3);assert.equal(await page.locator('.dashboard-intelligence-grid').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),3);}
      await page.locator('.universe-bubble').first().click();await page.waitForSelector('#asset-intelligence-dialog[open]');
      assert.match(await page.locator('#ai-title').innerText(),/BTW/);await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
      await page.screenshot({path:'.runtime/homepage-redesign-'+width+'.png',fullPage:true});
    }
    negative=true;await page.reload();await page.waitForFunction(()=>document.querySelector('.pnl-metric dd')?.textContent.includes('25.00'));
    assert.equal(await page.locator('.pnl-metric dd[data-tone=down]').count(),3);
    performanceMismatch=true;await page.reload();await page.waitForFunction(()=>document.querySelector('.pnl-metric dd')?.textContent==='Unavailable');
    assert.doesNotMatch(await page.locator('#homepage-bots').innerText(),/25.00/,'no cross-run contamination');
    performanceMismatch=false;negative=false;positionFresh=false;staleAssigned=true;await page.reload();
    await page.waitForFunction(()=>document.querySelector('#homepage-position-warning')?.textContent.startsWith('0 of 3'));
    assert.doesNotMatch(await page.locator('#homepage-activity-summary').innerText(),/DOGE/,'stale native positions are not current');
    assert.match(await page.locator('#homepage-position-warning').innerText(),/Missing or stale/);
    failUniverse=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#candidate-progress-list')?.textContent.includes('No candidate progress'));
    assert.match(await page.locator('#homepage-activity-summary').innerText(),/No current activity can be confirmed/);
    positionFresh=true;await page.evaluate(()=>refreshMarketSummary());
    await page.waitForFunction(()=>document.querySelector('#homepage-activity-summary')?.textContent.includes('DOGE'));
    assert.match(await page.locator('#homepage-activity-summary').innerText(),/DOGE/,'positions survive decision API failure');
    failUniverse=false;staleUniverse=true;failAssetDetails=true;await page.reload();
    await page.waitForFunction(()=>document.querySelector('#universe-status')?.textContent.includes('Stale'));
    assert.equal(await page.locator('.universe-card').count(),10);
    assert.doesNotMatch(await page.locator('.universe-live-state').first().innerText(),/selected horizon/);
    failAssetDetails=false;staleAssigned=false;staleUniverse=false;noCandidates=true;zeroPositions=true;slow=true;
    await page.reload({waitUntil:'domcontentloaded'});
    assert.match(await page.locator('.pnl-metric').first().innerText(),/Loading current-run P\/L/);
    assert.doesNotMatch(await page.locator('#homepage-bots').innerText(),/Bot data unavailable|V2 performance unavailable/,'calm loading before resolution');
    await page.waitForFunction(()=>document.querySelector('#homepage-activity-summary')?.textContent.includes('No positions or selected candidates confirmed'),{},{timeout:15000});
    assert.doesNotMatch(await page.locator('#homepage-activity-summary').innerText(),/Position open/,'old execution status alone is not a current position');
    assert.equal(await page.locator('.activity-row').count(),0);
    assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
    console.log('PASS: homepage order, ten cards/bubbles, collapsed details, native outside-universe positions, pending/selected/blocked/stale separation, V2 P/L/run scope/colours, 5 widths, modal, independent failure/recovery, sessions/DST, safe read-only rendering.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
