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
  let failed=false,stale=false,sign=0,equity,missingPairs=false,missingPerformance=false,researchFailed=false,marketStale=false;const calls=[];
  const pairs={short:['BTC/USDT:USDT','ETH/USDT:USDT'],medium:['SOL/USD','XRP/USD'],long:['LINK/USDT:USDT']};
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{
   const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);
   if(endpoint==='/score')return r.fulfill({status:researchFailed?503:200,json:{assets:[{pair:'BTC/USDT:USDT',trend_score:67,confidence:80,raw_veto:'private-debug'}]}});
   if(endpoint==='/api/market-summary')return r.fulfill({status:researchFailed?503:200,json:{currency:'USD',markets:['BTC','ETH','SOL','XRP','LINK'].map(symbol=>({symbol,price:100,change_24h:1,updated_at:new Date(Date.now()-(marketStale?180000:0)).toISOString()}))}});
   if(failed)return r.fulfill({status:503,json:{ok:false}});
   const key=endpoint.includes('/short/')?'short':endpoint.includes('/long/')?'long':'medium';
   const trade={pair:pairs[key][0],direction:sign>0?'SHORT':'LONG',open_rate:100,current_rate:110,close_rate:111,profit_abs:missingPerformance?null:sign*10,profit_pct:missingPerformance?null:sign,entry_tag:'secret-debug-version',exit_reason:'roi',open_date:new Date().toISOString(),close_date:new Date().toISOString()};
   return r.fulfill({json:{ok:true,demo:key,generated_at:Date.now()/1000-(stale?90:0),bot:{pairs:missingPairs?null:pairs[key],strategy:{short:'Short Term 15m',medium:'Medium 1hr',long:'Long Term 4hr'}[key],state:'RUNNING',mode:'PAPER',timeframe:{short:'15m',medium:'1h',long:'4h'}[key],exchange:'bybit',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,stake_currency:'USDT'},portfolio:{equity,starting_balance:1000,profit_all_abs:missingPerformance?null:sign*10,profit_all_pct:missingPerformance?null:sign,profit_closed_abs:missingPerformance?null:sign*10,profit_closed_pct:missingPerformance?null:sign,open_positions:1,winning_trades:0,losing_trades:0},open_trades:[trade],history:[trade]}});
  });
  const base='http://127.0.0.1:'+server.address().port;
  for(const key of keys){
   await page.goto(base+{short:'/demo/short/',medium:'/demo/',long:'/demo/long/'}[key]);
   await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');
   assert.equal(await page.locator('#openRows tr').count(),1);
   assert.match(await page.locator('#profit').innerText(),/0.00/);
   assert.equal(await page.locator('#balance').innerText(),'Unavailable');
   assert.match(await page.locator('#historyRows').innerText(),/Profit target/);
   assert.equal(await page.locator('.grid>.card').count(),8,'Six current metrics plus two historical percentage values');
   assert.deepEqual(await page.locator('.grid .label').allTextContents(),['Paper balance / equity','Total P/L','Realised P/L','Starting paper balance','Open positions','Win / loss','Total P/L %','Realised P/L %']);
   assert.deepEqual(await page.locator('#asset-cards article').evaluateAll(els=>els.map(el=>el.dataset.pair)),pairs[key]);
   assert.equal(await page.locator('#raw,#trading-context,#shadow-decisions,#policy-comparison,#settings').count(),0);
   assert(!/secret-debug-version|Freqtrade|Challenger|Admin|veto/i.test(await page.locator('main').innerText()));
   assert.equal(await page.locator('.timeframes [aria-current=page]').count(),1);
   assert.equal(await page.locator('.timeframes [aria-current=page]').innerText(),{short:'15 MIN',medium:'1 HOUR',long:'4 HOUR'}[key]);
   for(const value of [1,-1,0]){
    sign=value;await page.evaluate(()=>load());
    for(const selector of ['#profit','#profitPct','#realised','#realisedPct','#openRows td:nth-child(5)','#historyRows td:nth-child(5)']){
     assert.equal(await page.locator(selector).evaluate(el=>el.classList.contains('pos')),value>0,selector);
     assert.equal(await page.locator(selector).evaluate(el=>el.classList.contains('neg')),value<0,selector);
     if(value)assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el).color),value>0?'rgb(55, 230, 139)':'rgb(255, 93, 115)');
    }
    assert.equal(await page.locator('#profitPct').innerText(),value>0?'+1.00%':value<0?'-1.00%':'0.00%');
    assert.equal(await page.locator('#openRows td:nth-child(2)').innerText(),value>0?'SHORT':'LONG');
   }
   equity=1010;await page.evaluate(()=>load());assert.match(await page.locator('#balance').innerText(),/1,?010.00/);equity=undefined;
   missingPerformance=true;await page.evaluate(()=>load());
   for(const selector of ['#profit','#profitPct','#realised','#realisedPct','#openRows td:nth-child(5)','#historyRows td:nth-child(5)']){
    assert.equal(await page.locator(selector).innerText(),'Unavailable');assert(!/pos|neg/.test(await page.locator(selector).getAttribute('class')));
   }
   missingPerformance=false;missingPairs=true;await page.evaluate(()=>load());assert.equal(await page.locator('#asset-cards article').count(),0);assert.match(await page.locator('#asset-cards').innerText(),/unavailable/);
   missingPairs=false;await page.evaluate(()=>load());
   await page.evaluate(()=>renderDemoAssets([]));assert.match(await page.locator('#asset-cards').innerText(),/No configured assets/);
   await page.evaluate(()=>renderDemoAssets(['NEW/USDT:USDT']));assert.equal(await page.locator('#asset-cards article').count(),1);assert.match(await page.locator('#asset-cards').innerText(),/NEW/);assert.match(await page.locator('#asset-cards').innerText(),/Unavailable/);
   await page.evaluate(()=>load());
   for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+key+' '+width);
    assert.equal(await page.locator('.grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>900?4:width>560?2:1);
    assert.equal(await page.locator('#asset-cards').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>1100?4:width>600?2:1);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),`rrr-public-${key}-${width}.png`),fullPage:true});
   }
   sign=1;await page.evaluate(()=>load());
   stale=true;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'STALE');assert.equal(await page.locator('#openRows tr').count(),0);assert.equal(await page.locator('#asset-cards article').count(),0);assert.equal(await page.locator('#profit.pos,#profitPct.pos').count(),0);
   stale=false;failed=true;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'UNAVAILABLE');assert.equal(await page.locator('#profit').innerText(),'Unavailable');
   failed=false;sign=0;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'RUNNING');
   marketStale=true;await page.reload();await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');assert.match(await page.locator('#asset-cards').innerText(),/Stale or invalid market data/);marketStale=false;
   researchFailed=true;await page.reload();await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');
   assert.equal(await page.locator('#asset-cards article').count(),pairs[key].length);assert.match(await page.locator('#asset-cards').innerText(),/Unavailable/);researchFailed=false;
  }
  for(const label of ['15 MIN','1 HOUR','4 HOUR']){await page.locator('.timeframes a').filter({hasText:label}).click();await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');}
  assert(calls.every(p=>['/status','/api/demos/short/status','/api/demos/long/status','/score','/api/market-summary'].includes(p)),'No diagnostics requested publicly');
  await page.goto(base+'/');assert(await page.locator('body').isVisible());
  assert.deepEqual(errors,[]);
  console.log('PASS public presentation: eight cards, signed P/L and percentages, positive/negative/zero/unavailable colouring, bot-specific assets, missing/stale/failed research, three demos, timeframe navigation, zero/missing values, stale/outage/recovery, private diagnostics absent, 320/375/768/1440 layouts, homepage, no page errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
