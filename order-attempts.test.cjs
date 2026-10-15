const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const context={window:{}};vm.createContext(context);vm.runInContext(fs.readFileSync('bot-registry.js','utf8'),context);
const registry=context.window.BotRegistry;
assert.equal(registry.positionState({amount:0,stake_amount:500}),'ENTRY_PENDING');
assert.equal(registry.positionState({amount:.152,position_state:'PARTIALLY_FILLED'}),'PARTIALLY_FILLED');
assert.equal(registry.positionState({stake_amount:500}),'UNKNOWN');
const normalized=registry.positionReport({portfolio:{open_positions:2,total_trades:2,closed_trades:0,profit_all_abs:100},open_trades:[{amount:0},{amount:1}]});
assert.equal(normalized.open_trades.length,1);assert.equal(normalized.pending_orders.length,1);assert.equal(normalized.portfolio.open_positions,1);assert.equal(normalized.portfolio.profit_all_abs,null);assert.equal(registry.positionReport({portfolio:{open_positions:3},open_trades:null}).portfolio.open_positions,null);assert.equal(registry.positionReport({portfolio:{profit_all_abs:1},open_trades:[],pending_orders:[{amount:0}]}).portfolio.profit_all_abs,null);
assert.equal(registry.positionReport({portfolio:{open_positions:1},open_trades:[],pending_orders:{}}).portfolio.open_positions,null);
const {chromium}=require('playwright');
const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[],requests=[];await page.addInitScript(()=>sessionStorage.setItem('rrr.trading.v3.loaded-generation','2026-10-13T00:00:00Z'));await page.route('**/radio-navigation.js*',r=>r.fulfill({contentType:'application/javascript',body:''}));page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
 let scenario='pending';const run='v3-paper-fixture',start=new Date(Date.now()-3600000).toISOString();
 const raw=(bot)=>({id:1,pair:'XAU/USDT:USDT',direction:'SHORT',entry_tag:'v2paper:14769:149',amount:scenario==='partial'?.05:scenario==='filled'?.152:0,position_state:scenario==='partial'?'PARTIALLY_FILLED':scenario==='filled'?'OPEN':'ENTRY_PENDING',open_rate:4097.47,current_rate:4094.5,stake_amount:scenario==='partial'?163.8988:500,leverage:1.25,profit_abs:scenario==='filled'?1:null,profit_pct:scenario==='filled'?.2:null,open_date:new Date(Date.now()-60000).toISOString()});
 const health=()=>({run_id:run,started_at:start,mode:'PAPER',status:'available',enabled:true,stale:false,last_run:new Date().toISOString(),versions:{}});
 const record=(bot)=>({execution_id:8,symbol:'XAU',timeframe:{short:'15m',medium:'1h',long:'4h'}[bot],direction:'SHORT',status:scenario==='filled'||scenario==='partial'?'OPEN':scenario==='cancelled'||scenario==='rejected'?'CANCELLED':'UNKNOWN',order_state:{pending:'ENTRY_PENDING',partial:'PARTIALLY_FILLED',filled:'OPEN',cancelled:'TIMED_OUT',rejected:'REJECTED'}[scenario]||'UNKNOWN',order_evidence:scenario!=='old',opportunity_id:14769,sizing_id:149,requested_stake:500,executed_stake:scenario==='filled'?500:null,leverage:1.25,filled_amount:scenario==='filled'?.152:scenario==='partial'?.05:0,execution_price:scenario==='filled'?4097.47:null,native_trade_id:1,order_id:'dry_run_order',order_reason:'<img src=x onerror="window.BAD=1">',created_at:start,updated_at:new Date().toISOString()});
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{
  const u=new URL(r.request().url());requests.push(r.request().method());
  const bot=u.searchParams.get('bot')||(/\/short\//.test(u.pathname)?'short':/\/long\//.test(u.pathname)?'long':'medium');
  if(u.pathname.endsWith('/execution/health'))return r.fulfill({json:health()});
  if(u.pathname.endsWith('/execution/records'))return r.fulfill({json:{run_id:run,records:[record(bot)],...(scenario==='old'?{}:{order_evidence_version:'native-paper-order-v1'})}});
  if(u.pathname==='/api/system/generation')return r.fulfill({json:{generation:3,application:'RRR.Trading V3',phase:'ACTIVE',entries_blocked:false,run_id:run,factory_reset_at:'2026-10-13T00:00:00Z'}});
  if(u.pathname.endsWith('/reporting'))return r.fulfill({json:{available:true,run_id:run,started_at:start,observed_at:new Date().toISOString(),portfolio:{starting_balance:10000,open_positions:['pending','partial','filled','old'].includes(scenario)?1:0,closed_trades:0,winning_trades:0,losing_trades:0,profit_closed_abs:0,profit_open_abs:0,profit_all_abs:0,profit_all_pct:0,max_drawdown:0},open_trades:['pending','partial','filled','old'].includes(scenario)?[raw(bot)]:[],history:[]}});
  if(u.pathname==='/status'||u.pathname.endsWith('/status'))return r.fulfill({json:{ok:true,generated_at:Date.now()/1000,demo:bot,bot:{mode:'PAPER',state:'RUNNING',timeframe:{short:'15m',medium:'1h',long:'4h'}[bot],stake_currency:'USDT',stake_amount:1000,max_open_trades:5,entry_owner:'paper-execution-v1'},open_trades:['pending','partial','filled','old'].includes(scenario)?[raw(bot)]:[],history:[],portfolio:{}}});
  return r.fulfill({status:503,json:{}});
 });
 fs.mkdirSync('.runtime/order-attempts',{recursive:true});
 for(const url of ['/','/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/']){
  for(scenario of ['pending','partial','filled','cancelled','rejected','old']){
   console.log('CHECK',url,scenario);await page.goto(`http://127.0.0.1:${server.address().port}${url}`);
   const expected={pending:'ENTRY PENDING',partial:'PARTIALLY FILLED',filled:'OPEN',cancelled:'TIMED OUT',rejected:'REJECTED',old:'ENTRY PENDING'}[scenario];
   await page.waitForFunction(text=>document.querySelector('#order-attempts')?.textContent.includes(text),expected);
   assert.equal(await page.locator('#order-attempts img').count(),0);assert.equal(await page.evaluate(()=>window.BAD),undefined);
   if(url!=='/'&&scenario==='pending')assert.equal(await page.locator('#open-trades tr').count(),0,'Pending entries are not positions');
   if(url!=='/'&&['partial','filled'].includes(scenario))await page.waitForFunction(()=>document.querySelectorAll('#open-trades tr').length===1);
   if(url==='/'&&scenario==='pending')assert.equal(await page.locator('[data-open-position]').count(),0);
   if(scenario==='cancelled')assert((await page.locator('#order-attempts').innerText()).includes('500'));
   if(scenario==='old')assert((await page.locator('#order-attempts').innerText()).includes('installed backend'));
   const detail=page.locator('#order-attempts details').first();await detail.locator('summary').click();await page.waitForTimeout(1100);assert(await detail.evaluate(e=>e.open));
   for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});assert(await page.locator('#order-attempts').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'order panel width '+url+' '+width);}
   if(scenario==='cancelled')for(const width of [375,1440]){await page.setViewportSize({width,height:900});await page.locator('#order-attempts').screenshot({path:`.runtime/order-attempts/${url==='/'?'home':url.split('/')[2]}-${width}.png`});}
  }
 }
 scenario='filled';await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForSelector('#order-attempts article');
 const send=async patch=>page.evaluate(patch=>{const now=Date.now(),metadata={run_id:'v3-paper-fixture',started_at:new Date(now-3600000).toISOString(),mode:'PAPER',stale:false,last_run:new Date(now).toISOString()},records={run_id:'v3-paper-fixture',records:[{symbol:'BTC',timeframe:'15m',order_state:'OPEN',order_evidence:true}]};window.dispatchEvent(new CustomEvent('rrr-order-evidence',{detail:{metadata,records,recordsObserved:now,...patch}}));},patch);
 await send({recordsObserved:Date.now()-60000});assert.match(await page.locator('#order-attempts').innerText(),/saved only/);
 await send({recordsObserved:Date.now()-60000});assert.match(await page.locator('#order-attempts').innerText(),/current state unavailable/);
 await send({recordsObserved:Date.now()+60000});assert.match(await page.locator('#order-attempts').innerText(),/saved only/);
 await send({records:{run_id:'wrong-run',records:[]}});assert.match(await page.locator('#order-attempts').innerText(),/No absence of orders/);
 await send({records:{run_id:'v3-paper-fixture'}});assert.match(await page.locator('#order-attempts').innerText(),/No absence of orders/);
 await send({records:{run_id:'v3-paper-fixture',records:[null]}});assert.match(await page.locator('#order-attempts').innerText(),/No absence of orders/);await send({records:null});assert.equal(await page.locator('#order-attempts article').count(),0);
 await send({});assert.doesNotMatch(await page.locator('#order-attempts').innerText(),/saved only/);
 await page.unroute('**/radio-navigation.js*');await page.goto(`http://127.0.0.1:${server.address().port}/demo/15minbot/`);await page.waitForSelector('#page-content');const framed=page.frameLocator('#page-content');await framed.locator('#order-attempts article').first().waitFor();assert(await framed.locator('#order-attempts').isVisible());assert.equal(await framed.locator('#open-trades tr').count(),1);
 assert.deepEqual(errors,[]);assert(requests.every(m=>m==='GET'));console.log('PASS pending/partial/filled/cancelled/rejected/old-backend, safe text, persistent disclosures, GET-only, freshness/future/malformed/run-mismatch and persistent shell; all four pages at 320/375/768/1440');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exit(1);});
