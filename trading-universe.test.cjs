const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let failure=false,stale=false,expired=false,malformed=false,missingCounts=false;
  const assets='BTC ETH SOL XRP LINK ONDO AAVE UNI HYPE INJ'.split(' ').map((symbol,i)=>({rank:i+1,symbol,pair:symbol+'/USDT:USDT',opportunity_score:87-i,reason:'Fixture momentum evidence. Missing directional research.',trend:'positive',macro_fit_score:60,theme_score:65,research_score:null,catalyst_score:null,data_coverage:.7,data_confidence:.8,themes:['defi'],approved_for_new_entries:true}));
  const payload=()=>({schema_version:1,status:stale?'stale':'ok',reason:stale?'Retaining last-known-good selection':null,generated_at:new Date(Date.now()-3600000).toISOString(),valid_until:new Date(Date.now()+(expired?-1800000:86400000)).toISOString(),universe_version:'fixture-v1',researched_market_count:missingCounts?undefined:100,scoring_eligible_count:missingCounts?undefined:87,entry_eligible:!expired,macro_regime:'neutral',assets:malformed?assets.slice(0,9):assets,changes:{added:['LINK'],removed:['DOGE']},bot_sync:Object.fromEntries(['short','medium','long'].map(b=>[b,{status:b==='long'?'stale':'current',loaded:10,expected:10,universe_version:b==='long'?'old':'fixture-v1',checked_at:new Date().toISOString(),legacy_open_positions:b==='long'?[{pair:'DOGE/USDT:USDT'}]:[]}]))});
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>new URL(r.request().url()).pathname==='/api/trading-universe'?(failure?r.fulfill({status:503}):r.fulfill({json:payload()})):r.fulfill({status:503}));
  await page.goto('http://127.0.0.1:8765');
  await page.waitForFunction(()=>document.querySelectorAll('.universe-card').length===10);
  assert.match(await page.locator('#universe-summary').innerText(),/10 selected from 100 researched Bybit perpetual markets · 87 currently eligible/);
  assert.match(await page.locator('#universe-status').innerText(),/Continuously researched/);
  assert.equal(await page.locator('.universe-card').count(),10);
  assert.equal(await page.locator('.universe-analysis-reason').count(),10);
  assert.match(await page.locator('.universe-card').first().innerText(),/Fixture momentum evidence[\s\S]*80% evidence confidence/);
  assert.match(await page.locator('.universe-card').first().innerText(),/BTC\s+87\s+POSITIVE/);
  await page.locator('.universe-bubble').first().click();
  await page.waitForSelector('#asset-intelligence-dialog[open]');
  assert.match(await page.locator('#ai-title').innerText(),/BTC/);
  await page.getByRole('button',{name:'Close asset intelligence'}).click();
  const first = page.locator('.universe-bubble').first();
  await first.focus(); await first.press('Enter');
  assert(await page.locator('#asset-intelligence-dialog').evaluate(e=>e.open));
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
  assert(await first.evaluate(e=>e===document.activeElement));
  await page.locator('#how-it-works>.dashboard-details>summary').click();
  assert.match(await page.locator('#universe-sync').innerText(),/CURRENT · 10\/10 assets loaded/);
  assert.match(await page.locator('#universe-sync').innerText(),/STALE/);
  assert.match(await page.locator('#universe-sync').innerText(),/DOGE\/USDT:USDT/);
  for(const width of [320,375,768,1024,1280,1440,1920]){
   await page.setViewportSize({width,height:900});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);
   const expected = width >= 1000 ? 5 : width >= 700 ? 3 : width >= 360 ? 2 : 1;
   assert.equal(await page.locator('#universe-assets').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),expected);
   if(width>=1200) {
    const rows = await page.locator('.universe-card').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().top)));
    assert.equal(new Set(rows).size,2);
    assert.equal(rows.filter(y=>y===rows[0]).length,5);
   }
   if([375,1440].includes(width))await page.screenshot({path:'.runtime/universe-'+width+'.png',fullPage:true});
  }
  missingCounts=true;await page.evaluate(()=>refreshTradingUniverse());assert.match(await page.locator('#universe-summary').innerText(),/coverage unavailable/);missingCounts=false;
  stale=true;await page.evaluate(()=>refreshTradingUniverse());assert.match(await page.locator('#universe-status').innerText(),/Stale/);assert.equal(await page.locator('.universe-card').count(),10);
  expired=true;await page.evaluate(()=>refreshTradingUniverse());assert.equal(await page.locator('.universe-entry-state').allTextContents().then(es=>es.filter(e=>e==='New entries blocked').length),10);
  assert.doesNotMatch(await page.locator('#universe-sync').innerText(),/CURRENT/);
  malformed=true;await page.evaluate(()=>refreshTradingUniverse());assert.equal(await page.locator('.universe-card').count(),0);
  malformed=false;failure=true;await page.evaluate(()=>refreshTradingUniverse());assert.equal(await page.locator('.universe-card').count(),0);assert.match(await page.locator('#universe-status').innerText(),/unavailable/);
  assert.deepEqual(errors,[]);
  console.log('PASS: 10 real-contract cards, missing inputs, version-aware bot sync, legacy positions, expiry, malformed/unavailable states, desktop/mobile layouts; no page errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
