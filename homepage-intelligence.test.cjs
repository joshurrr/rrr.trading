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
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{
   const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);
   if(allFail || failShort && endpoint.includes('/short/'))return r.fulfill({status:503});
   const generated_at=Date.now()/1000-(stale?180:0);
   const key=endpoint.includes('/short/')?'short':endpoint.includes('/long/')?'long':'medium';
   const timeframe={short:'15m',medium:'1h',long:'4h'}[key];
   if(endpoint.endsWith('/status') || endpoint==='/status')return r.fulfill({json:{ok:true,generated_at,bot:{timeframe:wrong?'bad':timeframe,mode:'PAPER',state:'RUNNING',pairs:symbols.map(s=>s+'/USDT:USDT'),stake_currency:'USDT'},portfolio:{profit_closed_abs:key==='short'?-10:0,winning_trades:0,losing_trades:0,closed_trades:0}}});
   if(endpoint.endsWith('/decision-flow'))return r.fulfill({json:{ok:true,generated_at,bot:wrong?'bad':key,timeframe,traderouter:noSignal?{state:'UNAVAILABLE'}:{state:key==='long'?'FAIL-OPEN':'PASS',macro:{fresh:true}},final_decision:{state:noSignal?'NO SIGNAL':'UNKNOWN',timestamp:new Date().toISOString()}}});
   if(endpoint==='/api/trading-context')return r.fulfill({json:{mode:'observation_only',fresh:true,generated_at:new Date(Date.now()-(stale?720000:0)).toISOString(),crypto:{available:true,fresh:true,regime:'neutral',confidence:0}}});
   return r.fulfill({status:503});
  });
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base);
  await page.waitForFunction(()=>document.querySelector('#intelligence-regime').textContent==='NEUTRAL');
  assert.equal(await page.locator('.rrr-intro').count(),1);
  assert.equal(await page.locator('.rrr-intro h1').innerText(),'Always-on trading intelligence');
  assert.equal(await page.getByRole('heading',{name:'Assets We Trade'}).count(),0);
  assert.equal(await page.locator('.market-tile').count(),0);
  assert.ok((await page.locator('#intelligence-inputs').boundingBox()).y > (await page.locator('.rrr-intro').boundingBox()).y);
  assert.equal(await page.locator('#intelligence-confidence').innerText(),'0 / 100');
  assert.match(await page.locator('[data-home-bot=long]').innerText(),/FAIL-OPEN/);
  assert.match(await page.locator('[data-home-bot=short]').innerText(),/-10.00 USDT/);
  assert.match(await page.locator('[data-home-bot=medium]').innerText(),/0.00 USDT/);
  assert.match(await page.locator('[data-home-bot=medium]').innerText(),/No completed trades/);
  for(const endpoint of ['/status','/api/demos/short/status','/api/demos/long/status'])assert.equal(calls.filter(p=>p===endpoint).length,1,'Shared feed '+endpoint);
  for(const width of [320,375,768,1024,1440,1920]) {
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);
   if(width===1440)assert.ok(await page.locator('.rrr-intro-panel').evaluate(el=>el.getBoundingClientRect().width<innerWidth));
   if(width===1440 || width===375)await page.screenshot({path:path.join(__dirname,'.runtime','homepage-flow-'+width+'.png'),fullPage:true});
  }
  failShort=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.match(await page.locator('[data-home-bot=short]').innerText(),/Bot data unavailable/);
  assert.match(await page.locator('[data-home-bot=long]').innerText(),/FAIL-OPEN/);
  assert.match(await page.locator('#macro-summary').innerText(),/unavailable/);
  failShort=false;stale=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.equal(await page.locator('#intelligence-regime').innerText(),'Unavailable');
  assert.match(await page.locator('#intelligence-status').innerText(),/stale/);
  assert.match(await page.locator('[data-home-bot=long]').innerText(),/Stale or invalid/);
  stale=false;wrong=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.match(await page.locator('[data-home-bot=long]').innerText(),/Stale or invalid/);
  assert.doesNotMatch(await page.locator('#intelligence-decision').innerText(),/FAIL-OPEN/);
  wrong=false;noSignal=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.match(await page.locator('[data-home-bot=short]').innerText(),/NO SIGNAL · context not required/);
  allFail=true;await page.evaluate(()=>Promise.all([refreshMarketSummary(),refreshHomepageIntelligence()]));
  assert.equal(await page.locator('#intelligence-confidence').innerText(),'Unavailable');
  assert.match(await page.locator('[data-home-bot=short]').innerText(),/Bot data unavailable/);
  await page.locator('#demo-toggle').click();assert.equal(await page.locator('#demo-toggle').getAttribute('aria-expanded'),'true');
  for(const route of ['/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/'])assert.equal((await page.request.get(base+route)).status(),200);
  assert.deepEqual(errors,[]);
  console.log('PASS: shared status requests, real field mappings, zero/missing/stale/wrong feeds, independent failures, recovery, NO SIGNAL distinction, bot links/navigation, 6 responsive widths.');
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
