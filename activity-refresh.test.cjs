const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path');
const server = http.createServer((req,res) => {
  const pathname = new URL(req.url,'http://localhost').pathname;
  const file = path.join(__dirname,pathname === '/' ? 'index.html' : pathname);
  if (!file.startsWith(__dirname + path.sep)) return res.writeHead(403).end();
  fs.readFile(file,(err,data) => { if(err)return res.writeHead(404).end(); res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data); });
});
(async () => {
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const page = await browser.newPage(), errors = [];
    page.on('pageerror',e => errors.push(e.message));
    let at = Date.now(), failShort = false, closeShort = false, badShort = false, hold = false, release = null;
    const calls = {short:0,medium:0,long:0};
    await page.clock.install({time:at});
    await page.route('https://stream.radiorrr.com/**',r=>r.abort());
    await page.route('https://api.rrr.trading/**',async route => {
      const p = new URL(route.request().url()).pathname;
      const key = p === '/status' ? 'medium' : p === '/api/demos/short/status' ? 'short' : p === '/api/demos/long/status' ? 'long' : null;
      if (!key) return route.fulfill(p.endsWith('/opportunities') ? {json:{universe_sync:{selected_symbols:[]}}} : {status:503,json:{ok:false}});
      calls[key]++;
      if (key === 'short' && hold) await new Promise(r => {release=r;});
      if (key === 'short' && failShort) return route.fulfill({status:503,json:{ok:false}});
      const tf = {short:'15m',medium:'1h',long:'4h'}[key];
      return route.fulfill({json:{ok:true,generated_at:at/1000,status_observed_at:at/1000-3,bot:{mode:badShort&&key==='short'?'LIVE':'PAPER',timeframe:tf,stake_currency:'USDT',pairs:[],state:'RUNNING'},portfolio:{closed_trades:0},history:[],open_trades:closeShort&&key==='short'?[]:[{id:1,pair:'BAT/USDT:USDT',direction:'LONG',profit_abs:2,profit_pct:1,open_date:new Date(at-172800000).toISOString()}]}});
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(()=>document.querySelector('[data-performance="open"]').textContent==='3');
    const row = await page.locator('[data-open-position]').first().elementHandle();
    // Advancing real page timers exercises the feed owner, not just the renderer.
    for (let i=0;i<3;i++) {
      at+=30000;
      await page.clock.fastForward(30000);
      await page.waitForFunction(at=>window.homepageBotStatus?.short?.generated_at===at/1000,at);
      assert.equal(await page.locator('[data-open-position]').count(),3);
      assert.equal(await page.locator('[data-performance="open"]').innerText(),'3');
      assert.deepEqual(calls,{short:i+2,medium:i+2,long:i+2},'one request per feed every 30 seconds');
      assert.ok(await row.evaluate(n=>n.isConnected),'unchanged rows survive refresh cycles');
    }
    // A failed request retains only recent evidence, with an explicit warning.
    failShort=true;at+=30000;await page.clock.fastForward(30000);
    await page.waitForFunction(()=>window.homepageBotRefreshFailed?.short===true);
    assert.equal(await page.locator('[data-open-position]').count(),3);
    assert.match(await page.locator('#homepage-position-warning').textContent(),/refresh failed/);
    at+=30000;await page.clock.fastForward(30000);
    await page.waitForFunction(()=>window.homepageBotStatus?.short===null);
    assert.equal(await page.locator('[data-open-position]').count(),2);
    assert.equal(await page.locator('[data-performance="open"]').innerText(),'Unavailable');
    failShort=false;at+=30000;await page.clock.fastForward(30000);
    await page.waitForFunction(()=>document.querySelector('[data-performance="open"]').textContent==='3');
    closeShort=true;await page.evaluate(()=>refreshMarketSummary());
    assert.equal(await page.locator('[data-open-position]').count(),2,'closed position removed immediately');
    badShort=true;await page.evaluate(()=>refreshMarketSummary());
    assert.equal(await page.evaluate(()=>window.homepageBotStatus.short),null,'invalid fulfilled data never retains PAPER history as current');
    badShort=false;hold=true;
    const before={...calls};
    await page.evaluate(()=>{window.refreshOne=refreshMarketSummary();window.refreshTwo=refreshMarketSummary();window.sameRefresh=window.refreshOne===window.refreshTwo;});
    await page.waitForFunction(()=>window.sameRefresh===true);
    while(!release)await new Promise(r=>setTimeout(r,10));
    await page.evaluate(()=>{document.dispatchEvent(new Event('visibilitychange'));refreshMarketSummary();});
    assert.deepEqual(calls,{short:before.short+1,medium:before.medium+1,long:before.long+1},'concurrent visibility/manual refreshes share the same requests');
    hold=false;release();await page.evaluate(()=>window.refreshOne);
    assert.deepEqual(errors,[]);
    console.log('PASS: three real timer cycles, 30s request cadence, no vanished rows, bounded failed-refresh retention/expiry/recovery, closure, invalid mode, single-flight visibility/manual refresh.');
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
