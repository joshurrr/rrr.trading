const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
async function run(keys=['short','medium','long']){
 const root=__dirname;
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let file=path.join(root,decodeURIComponent(url.pathname));
  if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let failed=false,stale=false;const calls=[];
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{
   const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);
   if(failed)return r.fulfill({status:503,json:{ok:false}});
   const key=endpoint.includes('/short/')?'short':endpoint.includes('/long/')?'long':'medium';
   const trade={pair:'BTC/USDT:USDT',direction:'LONG',open_rate:100,current_rate:110,close_rate:111,profit_abs:0,profit_pct:0,entry_tag:'secret-debug-version',exit_reason:'roi',open_date:new Date().toISOString(),close_date:new Date().toISOString()};
   return r.fulfill({json:{ok:true,demo:key,generated_at:Date.now()/1000-(stale?90:0),bot:{strategy:{short:'Short Term 15m',medium:'Medium 1hr',long:'Long Term 4hr'}[key],state:'RUNNING',mode:'PAPER',timeframe:{short:'15m',medium:'1h',long:'4h'}[key],exchange:'bybit',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,stake_currency:'USDT'},portfolio:{starting_balance:1000,profit_all_abs:0,profit_closed_abs:0,open_positions:1,winning_trades:0,losing_trades:0},open_trades:[trade],history:[trade]}});
  });
  const base='http://127.0.0.1:'+server.address().port;
  for(const key of keys){
   await page.goto(base+{short:'/demo/short/',medium:'/demo/',long:'/demo/long/'}[key]);
   await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');
   assert.equal(await page.locator('#openRows tr').count(),1);
   assert.match(await page.locator('#profit').innerText(),/0.00/);
   assert.equal(await page.locator('#balance').innerText(),'Unavailable');
   assert.match(await page.locator('#historyRows').innerText(),/Profit target/);
   assert.equal(await page.locator('#raw,#trading-context,#shadow-decisions,#policy-comparison,#settings,#asset-analysis').count(),0);
   assert(!/secret-debug-version|Freqtrade|Challenger|Admin|veto/i.test(await page.locator('main').innerText()));
   assert.equal(await page.locator('.timeframes [aria-current=page]').count(),1);
   for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+key+' '+width);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),`rrr-public-${key}-${width}.png`),fullPage:true});
   }
   stale=true;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'STALE');assert.equal(await page.locator('#openRows tr').count(),0);
   stale=false;failed=true;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'UNAVAILABLE');assert.equal(await page.locator('#profit').innerText(),'Unavailable');
   failed=false;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'RUNNING');
  }
  for(const label of ['15 MIN','1 HOUR','4 HOUR']){await page.locator('.timeframes a').filter({hasText:label}).click();await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');}
  assert(calls.every(p=>['/status','/api/demos/short/status','/api/demos/long/status'].includes(p)),'No diagnostics requested publicly');
  await page.goto(base+'/');assert(await page.locator('body').isVisible());
  assert.deepEqual(errors,[]);
  console.log('PASS public presentation: three demos, timeframe navigation, zero/missing values, stale/outage/recovery, private diagnostics absent, 320/375/768/1440 layouts, homepage, no page errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
