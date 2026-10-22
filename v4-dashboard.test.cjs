// Local HTTP fixtures only; no live trading/account endpoints or external data.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

function fixture(state) {
  const at = new Date().toISOString(), until = new Date(Date.now()+600000).toISOString();
  const wallet = {availability:'AVAILABLE', as_of:at, wallet_balance:'10000', equity:'10012.50', realized_pnl:'10', unrealized_pnl:'2.50',
    last_known:{wallet_balance:'10000', equity:'10012.50', realized_pnl:'10', unrealized_pnl:'2.50'}};
  const position = (symbol, side) => ({symbol, side, exchange:'bybit', availability:'AVAILABLE', entry_price:'100', current_mark:'102', protective_stop:side==='LONG'?'95':'105',
    leverage:'2', unrealized_pnl:side==='LONG'?'2.50':'-2.50', last_known_mark:'102', last_known_unrealized_pnl:'2.50', mark_observed_at:at, mark_expires_at:until});
  const trade = {symbol:'SOLUSDT', exchange:'bybit', side:'SHORT', entry_price:'150', exit_price:'155', entered_at:at, closed_at:at,
    realized_pnl:'-12.34', net_pnl:'-13.56', exit_reason:'PROTECTIVE_STOP'};
  const data = {version:'paper-read-api-v1', mode:'paper', served_at:at, wallet, open_positions:{availability:'AVAILABLE',items:[position('BTCUSDT','LONG'),position('ETHUSDT','SHORT')]},
    completed_trades:{availability:'AVAILABLE',items:[trade]}, latest_cycle:{availability:'AVAILABLE',status:'ATTENTION',started_at:at,reasons:['position_monitoring_incomplete'],
      monitoring:{status:'ATTENTION',requested_positions:2,monitored_count:1,unmonitored:[{symbol:'BTCUSDT',reasons:['price_unavailable']}]}},
    sentiment:{availability:'AVAILABLE',context_state:'CURRENT',status:'USABLE',market_direction:'UP',assessment_timestamp:at,entry_expires_at:until,confidence:null,confidence_status:'UNKNOWN',risk_regime:null,risk_regime_status:'UNKNOWN'},
    private_admin:{password:'PRIVATE_SENTINEL_DO_NOT_DISPLAY'}};
  if (state === 'stale') {
    data.wallet.availability='STALE'; data.open_positions.availability='STALE'; data.latest_cycle.availability='STALE';
    for (const key of ['wallet_balance','equity','realized_pnl','unrealized_pnl']) data.wallet[key]=null;
    for (const p of data.open_positions.items) { p.availability='STALE';p.current_mark=null;p.unrealized_pnl=null; }
    data.sentiment.availability='STALE';data.sentiment.context_state='CONTEXT_ONLY';data.sentiment.status='BLOCKED';
  }
  if (state.startsWith('ledger-')) {
    wallet.ledger_availability='AVAILABLE';wallet.valuation_availability='AVAILABLE';
    wallet.field_availability={wallet_balance:'AVAILABLE',equity:'AVAILABLE',realized_pnl:'AVAILABLE',unrealized_pnl:'AVAILABLE'};
    wallet.valuation_expires_at=until;
    if(state==='ledger-idle') {
      wallet.as_of=new Date(Date.now()-7*86400000).toISOString();
      wallet.valuation_basis='LEDGER_ONLY_NO_OPEN_POSITIONS';wallet.valuation_expires_at=null;
      wallet.equity='10000';wallet.realized_pnl='0';wallet.unrealized_pnl='0';data.open_positions.items=[];
    }
    if(state==='ledger-stale') {
      wallet.availability='STALE';wallet.valuation_availability='STALE';
      for(const key of ['equity','unrealized_pnl']) {wallet.field_availability[key]='STALE';wallet[key]=null;}
      data.open_positions.availability='STALE';
      for(const p of data.open_positions.items) {p.availability='STALE';p.current_mark=null;p.unrealized_pnl=null;}
    }
    if(state==='ledger-expired-marks') for(const p of data.open_positions.items) p.mark_expires_at=new Date(Date.now()-1000).toISOString();
    if(state==='ledger-expired-valuation') wallet.valuation_expires_at=new Date(Date.now()-1000).toISOString();
  }
  if (state === 'empty') {
    data.wallet.realized_pnl='0';data.wallet.unrealized_pnl=0;
    data.open_positions.items=[];data.completed_trades.items=[];
  }
  if (state === 'unavailable') for (const key of ['wallet','open_positions','completed_trades','latest_cycle','sentiment']) data[key]={availability:'UNAVAILABLE'};
  if (state === 'unknown-cycle') {data.latest_cycle={availability:'UNAVAILABLE'};}
  if (state === 'unknown-coverage') data.latest_cycle.monitoring.unmonitored=null;
  if (state === 'live') data.mode='live';
  if (state === 'nested-live') data.open_positions.items[0].mode='live';
  if (state === 'wrong-version') data.version='legacy-paper-api-v3';
  if (state === 'expired') for (const p of data.open_positions.items) p.mark_expires_at=new Date(Date.now()-1000).toISOString();
  if (state === 'malformed') data.open_positions.items={};
  if (state === 'missing-values') {data.wallet.wallet_balance=null;data.wallet.equity='';data.wallet.realized_pnl=false;data.wallet.unrealized_pnl='NaN';}
  if (state === 'safe-text') {data.open_positions.items[0].symbol='<img src=x onerror="window.BAD=1">';data.completed_trades.items[0].exit_reason='<script>window.BAD=1</script>';}
  return data;
}

(async () => {
  const root=__dirname;
  const server=http.createServer((req,res)=>{
    const target=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html')));
    if (!target.startsWith(root+path.sep)) return res.writeHead(403).end();
    fs.readFile(target,(error,body)=>{
      if(error)return res.writeHead(404).end();
      res.setHeader('Content-Type',target.endsWith('.js')?'application/javascript':target.endsWith('.css')?'text/css':target.endsWith('.png')?'image/png':'text/html');res.end(body);
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[], requests=[];
    page.on('pageerror',error=>errors.push(error.message));
    let state='loading', release;
    const gate=new Promise(resolve=>{release=resolve;});
    await page.route('**/v4/paper',async route=>{
      const request=route.request(), url=new URL(request.url());
      assert.equal(url.origin,`http://127.0.0.1:${server.address().port}`,'dashboard uses its own HTTP service');
      assert.equal(url.pathname,'/v4/paper');assert.equal(request.method(),'GET');
      assert.equal(request.headers().authorization,undefined);assert.equal(request.headers().cookie,undefined);
      requests.push(url.pathname);
      if(state==='loading')await gate;
      if(state==='error')return route.fulfill({status:503,body:'unavailable'});
      if(state==='invalid-json')return route.fulfill({status:200,body:'{bad json',contentType:'application/json'});
      return route.fulfill({json:fixture(state)});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/v4/`,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#feed-status').textContent==='Loading');
    assert.equal(await page.locator('#main').getAttribute('aria-busy'),'true');
    assert.match(await page.locator('#wallet-equity').innerText(),/Loading/);
    state='fresh';release();
    await page.waitForFunction(()=>!document.querySelector('#refresh-paper').disabled);
    async function send(next) {
      state=next;await page.locator('#refresh-paper').click();
      await page.waitForFunction(()=>!document.querySelector('#refresh-paper').disabled);
    }
    assert.doesNotMatch(await page.locator('body').innerText(),/\bpaper\b/i);
    assert.equal(await page.locator('#wallet-equity').innerText(),'10,012.50 USDT','API equity is displayed, never recalculated');
    assert.equal(await page.locator('#positions-list article').count(),2);
    assert.match(await page.locator('#positions-list').innerText(),/LONG/);assert.match(await page.locator('#positions-list').innerText(),/SHORT/);
    assert.match(await page.locator('#monitoring-notice').innerText(),/unmonitored demo positions/);
    assert.match(await page.locator('#cycle-coverage').innerText(),/1 \/ 2/);
    assert.match(await page.locator('#unmonitored-list').innerText(),/BTCUSDT/);
    assert.match(await page.locator('#trades-list').innerText(),/-12.34 USDT/);
    assert.match(await page.locator('#trades-list').innerText(),/Net after fees: -13.56 USDT/);
    assert.match(await page.locator('#sentiment-unknowns').innerText(),/Confidence: unknown · Risk regime: unknown/);
    assert(!await page.locator('body').innerText().then(t=>t.includes('PRIVATE_SENTINEL')));
    const output=path.join(root,'.runtime','v4-paper');fs.mkdirSync(output,{recursive:true});
    for (const width of [1440,390]) {
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no page overflow at '+width);
      await page.screenshot({path:path.join(output,`fresh-${width}.png`),fullPage:true});
    }
    await page.keyboard.press('Tab'); // Explicit focus check below is independent of initial browser focus.
    await page.locator('#refresh-paper').focus();assert(await page.locator('#refresh-paper').evaluate(n=>n===document.activeElement));
    await send('stale');
    assert.equal(await page.locator('#wallet-equity').innerText(),'Unavailable');
    assert.match(await page.locator('#equity-note').innerText(),/STALE · Last known: 10,012.50 USDT/);
    assert.match(await page.locator('#positions-list').innerText(),/Last known: 102/);
    assert.match(await page.locator('#unmonitored-list').innerText(),/BTCUSDT/,'stale cycle never hides its failures');
    assert.match(await page.locator('#sentiment-state').innerText(),/Context only/i);
    assert.match(await page.locator('#sentiment-detail').innerText(),/not fresh confirmation/);
    assert.equal(await page.locator('.position-details>div').first().evaluate(n=>getComputedStyle(n).display),'block','position values stack above last-known notes');
    await page.screenshot({path:path.join(output,'stale-390.png'),fullPage:true});
    await send('ledger-idle');
    assert.equal(await page.locator('#wallet-balance').innerText(),'10,000.00 USDT');
    assert.equal(await page.locator('#wallet-equity').innerText(),'10,000.00 USDT');
    assert.match(await page.locator('#equity-note').innerText(),/Ledger only .* no open positions/);
    for(const state of ['ledger-stale','ledger-expired-marks','ledger-expired-valuation']) {
      await send(state);
      assert.equal(await page.locator('#wallet-balance').innerText(),'10,000.00 USDT');
      assert.equal(await page.locator('#wallet-realized').innerText(),'10.00 USDT');
      assert.equal(await page.locator('#wallet-equity').innerText(),'Unavailable');
      assert.equal(await page.locator('#wallet-unrealized').innerText(),'Unavailable');
      assert.match(await page.locator('#equity-note').innerText(),/STALE/);
    }
    await send('ledger-stale');
    assert.match(await page.locator('#unmonitored-list').innerText(),/BTCUSDT/);
    await page.screenshot({path:path.join(output,'ledger-stale-390.png'),fullPage:true});
    await send('expired');assert.equal(await page.locator('#wallet-equity').innerText(),'Unavailable');
    await send('empty');assert.equal(await page.locator('#wallet-realized').innerText(),'0.00 USDT');
    assert.equal(await page.locator('#wallet-unrealized').innerText(),'0.00 USDT');
    assert.match(await page.locator('#positions-list').innerText(),/No open demo positions recorded/);
    assert.match(await page.locator('#trades-list').innerText(),/No completed demo trades recorded/);
    await send('unavailable');assert.match(await page.locator('#positions-list').innerText(),/unavailable/);
    assert.doesNotMatch(await page.locator('#positions-list').innerText(),/No open/);
    await send('unknown-cycle');assert.match(await page.locator('#monitoring-notice').innerText(),/Monitoring coverage is unknown/);
    await send('unknown-coverage');assert.match(await page.locator('#cycle-coverage').innerText(),/unknown/);
    await send('missing-values');for (const id of ['wallet-balance','wallet-equity','wallet-realized','wallet-unrealized']) assert.equal(await page.locator('#'+id).innerText(),'Unavailable');
    for (const mode of ['live','nested-live','wrong-version','malformed','invalid-json','error']) {
      await send(mode);assert.equal(await page.locator('#feed-status').textContent(),'Error');
      assert.equal(await page.locator('#positions-list article').count(),0);
      assert.equal(await page.locator('#wallet-balance').innerText(),'Unavailable');
    }
    await page.screenshot({path:path.join(output,'error-390.png'),fullPage:true});
    await send('safe-text');assert.equal(await page.locator('#positions-list img,#trades-list script').count(),0);
    assert.equal(await page.evaluate(()=>window.BAD),undefined);
    await send('fresh');assert.equal(await page.locator('#positions-list article').count(),2,'recovery after error');
    assert.equal(await page.locator('button').count(),1,'only read-only refresh, no trading/configuration controls');
    assert.equal(await page.locator('form,input,select').count(),0);
    assert(requests.length>1);assert.deepEqual(errors,[]);
    console.log('V4 dashboard: desktop/mobile, loading, fresh/stale/missing/error, zero/empty, monitoring failures, paper-only rejection, safe DOM, refresh recovery and GET-only checks passed.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
