const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.join(__dirname,pathname.endsWith('/')?pathname+'index.html':pathname);
  if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage();const errors=[],calls=[];
  page.on('pageerror',e=>errors.push(e.message));
  let failShort=false,stale=false,wrong=false,noSignal=false,allFail=false;
  const symbols=['BTC','ETH','SOL','XRP','LINK','ONDO','AAVE','UNI','HYPE','INJ'];
  const runId='v2-paper-home-fixture';
  const runStart=new Date(Date.now()-3600000).toISOString();
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{
   const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);
   if(allFail || failShort && endpoint.includes('/short/'))return r.fulfill({status:503});
   const generated_at=Date.now()/1000-(stale?180:0);
   const key=endpoint.includes('/short/')?'short':endpoint.includes('/long/')?'long':'medium';
   const timeframe={short:'15m',medium:'1h',long:'4h'}[key];
   if(endpoint.endsWith('/opportunities'))return r.fulfill({json:{api_version:'2.6.0-phase8',universe_sync:{fresh:true,synced_at:new Date().toISOString(),valid_until:new Date(Date.now()+600000).toISOString(),selected_symbols:symbols},opportunities:[]}});
   if(/^\/api\/v2\/intelligence\/assets\/[^/]+$/.test(endpoint)){
    const symbol=endpoint.split('/').pop();const decision={id:symbol,decision_time:new Date().toISOString(),decision:'NO_GO',direction:'NEUTRAL',selected_timeframe:null,reason_summary:'NO_TIMEFRAME_CLEARS_THRESHOLDS',available:true,freshness:'FRESH',timeframe_assessments:Object.fromEntries(['15m','1h','4h'].map(tf=>[tf,{timeframe:tf,direction:'UNKNOWN',status:'NO_EDGE',reason_summary:'NO_CLEAR_DIRECTION',created_at:new Date().toISOString(),evidence:{flags:[],freshness:{technical_at:new Date().toISOString()}}}]))};return r.fulfill({json:{asset:{symbol},decision,execution:{health:{mode:'PAPER',status:'available',enabled:true,stale:false,run_id:runId,last_run:new Date().toISOString()},latest_execution:null,active_position:false,reservation_pending:false},sizing:{available:false,freshness:'UNAVAILABLE'}}});
   }
   if(endpoint.endsWith('/execution/health'))return r.fulfill({json:{mode:'PAPER',status:'available',enabled:true,stale:false,run_id:runId,last_run:new Date().toISOString(),started_at:runStart}});
   if(endpoint.endsWith('/reporting'))return r.fulfill({json:{available:true,run_id:runId,started_at:runStart,observed_at:new Date().toISOString(),portfolio:{profit_closed_abs:0,closed_trades:0,win_rate:null},history:[],open_trades:[]}});
   if(endpoint.endsWith('/execution/performance'))return r.fulfill({json:{available:true,run_id:runId,realized_pnl:0,trade_count:0,win_rate:null}});
   if(endpoint.endsWith('/status') || endpoint==='/status')return r.fulfill({json:{ok:true,generated_at,bot:{timeframe:wrong?'bad':timeframe,mode:'PAPER',state:'RUNNING',pairs:symbols.map(s=>s+'/USDT:USDT'),stake_currency:'USDT'},portfolio:{profit_closed_abs:key==='short'?-10:0,winning_trades:0,losing_trades:0,closed_trades:0}}});
   if(endpoint.endsWith('/decision-flow'))return r.fulfill({json:{ok:true,generated_at,bot:wrong?'bad':key,timeframe,traderouter:noSignal?{state:'UNAVAILABLE'}:{state:key==='long'?'FAIL-OPEN':'PASS',macro:{fresh:true}},final_decision:{state:noSignal?'NO SIGNAL':'UNKNOWN',timestamp:new Date().toISOString()}}});
   if(endpoint==='/api/trading-context')return r.fulfill({json:{mode:'observation_only',fresh:true,generated_at:new Date(Date.now()-(stale?720000:0)).toISOString(),crypto:{available:true,fresh:true,regime:'neutral',confidence:0}}});
   return r.fulfill({status:503});
  });
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#intelligence-regime').textContent==='NEUTRAL');
  await page.waitForFunction(()=>document.querySelector('[data-home-bot=short] dl')?.innerText.includes('0.00 USDT'));
  assert.equal(await page.locator('#live-candidate-progress').count(),1);
  assert.equal(await page.locator('#candidate-progress-list .candidate-row').count(),10);
  assert.equal(await page.locator('#live-candidate-title').innerText(),'TRADING PERFORMANCE · LAST 24 HOURS');
  assert.equal(await page.getByRole('heading',{name:'Assets We Trade'}).count(),0);
  assert.equal(await page.locator('.market-tile').count(),0);
  assert.ok((await page.locator('#intelligence-inputs').boundingBox()).y > (await page.locator('#top-opportunities').boundingBox()).y);
  assert.equal(await page.locator('#intelligence-confidence').innerText(),'0 / 100');
  assert.match(await page.locator('[data-home-bot=long]').innerText(),/0 assigned · No Go/);
  assert.match(await page.locator('[data-home-bot=short] dl').innerText(),/Realized P\/L\s+0\.00 USDT/);
  assert.match(await page.locator('[data-home-bot=medium] dl').innerText(),/No completed trades yet/);
  assert.doesNotMatch(await page.locator('#homepage-bots').innerText(),/-10\.00 USDT/);
  for(const endpoint of ['/status','/api/demos/short/status','/api/demos/long/status'])assert.equal(calls.filter(p=>p===endpoint).length,1,'Shared feed '+endpoint);
  for(const width of [320,375,768,1024,1440,1920]) {
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);
   if(width===1440)assert.ok(await page.locator('#live-candidate-progress').evaluate(el=>el.getBoundingClientRect().width<innerWidth));
   if(width===1440 || width===375)await page.screenshot({path:path.join(__dirname,'.runtime','homepage-flow-'+width+'.png'),fullPage:true});
  }
  failShort=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.match(await page.locator('[data-home-bot=short]').innerText(),/Refresh failed · last observed/);
  assert.match(await page.locator('[data-home-bot=long]').innerText(),/0 assigned · No Go/);
  assert.match(await page.locator('#macro-summary').innerText(),/unavailable/);
  failShort=false;stale=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.equal(await page.locator('#intelligence-regime').innerText(),'Unavailable');
  assert.match(await page.locator('#intelligence-status').innerText(),/stale/);
  assert.match(await page.locator('[data-home-bot=long]').innerText(),/Stale or invalid/);
  stale=false;wrong=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.match(await page.locator('[data-home-bot=long]').innerText(),/Stale or invalid/);
  assert.doesNotMatch(await page.locator('#intelligence-decision').innerText(),/FAIL-OPEN/);
  wrong=false;noSignal=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.match(await page.locator('#intelligence-decision').textContent(),/NO SIGNAL · context not required/);
  allFail=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.equal(await page.locator('#intelligence-confidence').innerText(),'Unavailable');
  assert.match(await page.locator('[data-home-bot=short]').innerText(),/Refresh failed · last observed/);
  assert.equal(await page.locator('.operating-modes .mode-button').count(),4);
  for(const route of ['/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/'])assert.equal((await page.request.get(base+route)).status(),200);
  assert.deepEqual(errors,[]);
  console.log('PASS: shared status requests, real field mappings, zero/missing/stale/wrong feeds, independent failures, recovery, NO SIGNAL distinction, bot links/navigation, 6 responsive widths.');
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
