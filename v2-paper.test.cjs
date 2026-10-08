const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
 let statusFail=false,empty=false,fail=false,shadowFail=false,stale=false,runId='future-paper-fixture<script>',start='2030-01-01T00:00:00Z';
 const closed={id:2,pair:'JUP/USDT:USDT',direction:'LONG',open_rate:5,close_rate:6,profit_abs:10,profit_pct:1,open_date:'2030-01-01T01:00:00Z',close_date:'2030-01-01T02:00:00Z',exit_reason:'trailing_stop_loss'};
 const report=()=>({available:!fail,run_id:runId,started_at:start,observed_at:new Date(Date.now()-(stale?60000:0)).toISOString(),portfolio:{starting_balance:10000,winning_trades:empty?0:1,losing_trades:0,closed_trades:empty?0:1,total_trades:empty?1:2,win_rate:empty?null:100,profit_all_abs:empty?-2:8,profit_closed_abs:empty?0:10,profit_open_abs:-2,profit_all_pct:empty?-.02:.08,max_drawdown:0},history:empty?[]:[closed],open_trades:[{...closed,id:3,pair:'BTC/USDT:USDT',close_date:null,current_rate:4,stake_amount:100,profit_abs:-2}]});
 await page.route('https://api.rrr.trading/**',r=>{
 const url=r.request().url();
 if(url.endsWith('/reporting'))return r.fulfill({json:report()});
 if(url.includes('/execution/')){
  if(shadowFail)return r.fulfill({status:503,json:{}});
  if(url.includes('/health'))return r.fulfill({json:{mode:'PAPER',status:'available',enabled:true,stale:false,run_id:runId,started_at:start}});
  return r.fulfill({json:{run_id:runId,records:[]}});
 }
 if((url.endsWith('/status')||url.endsWith('/api/status'))&&statusFail)return r.fulfill({status:503,json:{}});
 if(url.endsWith('/status')||url.endsWith('/api/status'))return r.fulfill({json:{ok:true,generated_at:Date.now()/1000,demo:url.includes('/short/')?'short':url.includes('/long/')?'long':'medium',bot:{entry_owner:'paper-execution-v1',state:'RUNNING',pairs:[],started_at:1,mode:'PAPER',strategy:url.includes('/short/')?'Short Term 15m':url.includes('/long/')?'Long Term 4hr':'Medium 1hr',timeframe:url.includes('/short/')?'15m':url.includes('/long/')?'4h':'1h',exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true},portfolio:{profit_all_abs:999,winning_trades:99},open_trades:[{...closed,id:3,pair:'BTC/USDT:USDT',open_date:start,current_rate:4,stake_amount:100,profit_abs:-2},{...closed,id:1,pair:'LEGACY/USDT:USDT',open_date:'2029-12-31 23:59:59'}],history:[{...closed,id:1,pair:'LEGACY/USDT:USDT'}]}});
 return r.fulfill({status:503,json:{}});
 });
 for(const folder of ['15minbot','1hrbot','4hrbot']){
  for(const scenario of ['current','shadow-unavailable','status-unavailable','empty','source-unavailable','stale','future-run']){
   statusFail=scenario==='status-unavailable';empty=scenario==='empty'||scenario==='future-run';fail=scenario==='source-unavailable';stale=scenario==='stale';shadowFail=scenario==='shadow-unavailable';
   runId=scenario==='future-run'?'v3-paper-next':'future-paper-fixture<script>';start=scenario==='future-run'?'2031-01-01T00:00:00Z':'2030-01-01T00:00:00Z';
   await page.clock.setSystemTime(new Date());
   await page.goto(`http://127.0.0.1:${server.address().port}/demo/${folder}/`);
   try { await page.waitForFunction(()=>document.querySelector('#completed-scope')?.textContent.includes('Reporting scope:')); } catch(e) { console.log(folder,scenario,errors,await page.locator('#completed-status').innerText(),await page.locator('#v2-paper').innerText()); throw e; }
   if(!fail&&!stale)await page.waitForFunction(({empty})=>document.querySelector('#completed-status')?.textContent===(empty?'No completed trades in the current paper run yet.':'1 recent completed trades'),{empty});
   const out=await page.evaluate(()=>V2Paper.overlay({bot:{entry_owner:'paper-execution-v1'},portfolio:{profit_all_abs:999},history:[{id:1}],open_trades:[]}));
   if(fail||stale){assert.equal(out.history,null);assert.equal(out.open_trades,null);
    const native=await page.evaluate(({started})=>V2Paper.overlay({generated_at:Date.now()/1000,bot:{entry_owner:'paper-execution-v1'},open_trades:[{id:1,open_date:'2029-12-31 23:59:59'},{id:2,open_date:started}]}),{started:start});assert.deepEqual(native.open_trades.map(t=>t.id),[2]);assert((await page.locator('#completed-status').innerText()).includes('UNAVAILABLE'));}
   else{
    assert.equal(out.portfolio.profit_all_abs,empty?-2:8);assert.equal(out.open_trades.length,1);assert.equal(await page.locator('#open-trades tr').count(),1);assert.equal(out.history.length,empty?0:1);
    if(await page.locator('#profit').count())assert((await page.locator('#profit').textContent()).includes(empty?'-2.00':'8.00'),folder+' '+scenario+' '+await page.locator('#profit').textContent());
    if(await page.locator('#completed').count())assert.equal(await page.locator('#completed').textContent(),empty?'0':'1');
    const text=await page.locator('#completed-trades').innerText();assert(!text.includes('LEGACY'));
    if(empty){assert((await page.locator('#completed-status').innerText()).includes('No completed trades'));assert(!(await page.locator('#completed-status').innerText()).includes('UNAVAILABLE'));}
    else{assert(text.includes('JUP/USDT'));assert(text.includes('10.00 USDT'));assert(await page.locator('#completed-trades .trade-profit').count());}
    assert((await page.locator('#completed-scope').innerText()).includes(runId));assert((await page.locator('#completed-scope').innerText()).includes('Brisbane'));
   }
   assert.equal(await page.locator('#v2-paper script').count(),0);
   for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});assert(await page.locator('#v2-paper').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert(await page.locator('#completed-scope').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
   if(scenario==='current'){
    for(const width of [375,1440]){await page.setViewportSize({width,height:900});await page.locator('.completed-trades-section').screenshot({path:`.runtime/current-reporting-${folder}-${width}.png`});}
    fail=true;await page.clock.fastForward(15000);
    await page.waitForFunction(()=>document.querySelector('#completed-status').textContent.startsWith('STALE'));
    assert.equal(await page.locator('#completed-trades tr').count(),1,'saved closed trades survive failed refresh');
    const unavailable=await page.evaluate(()=>V2Paper.overlay({bot:{}}));assert.equal(unavailable.history,null);assert.equal(unavailable.saved_closed_reporting.history.length,1);assert.equal(unavailable.portfolio.profit_all_abs,undefined,'saved history never becomes current performance');
    fail=false;await page.clock.fastForward(15000);await page.waitForFunction(()=>document.querySelector('#completed-status').textContent==='1 recent completed trades');
    fail=true;runId='different-run';start='2031-01-01T00:00:00Z';await page.clock.fastForward(15000);
    await page.waitForFunction(()=>document.querySelector('#completed-scope').textContent.includes('different-run'));
    assert.equal(await page.locator('#completed-trades tr').count(),0,'saved closed trades never leak into a different run');
   }
  }
 }
 assert.deepEqual(errors,[]);console.log('PASS current native trades, legacy isolation, shadow outage, empty/source unavailable/stale/future scopes, safe text, all bots and 320/375/768/1440');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
