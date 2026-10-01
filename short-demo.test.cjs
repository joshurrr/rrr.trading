const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
(async () => {
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage();
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 let outage=false,stale=false,wrong=false,empty=false,missing=false,macroStale=false,macroOutage=false;
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{
  requests.push(new URL(r.request().url()).pathname);
  if(new URL(r.request().url()).pathname==='/api/reports/macro/today') {
   if(macroOutage)return r.fulfill({status:503});
   return r.fulfill({json:{report_type:'macro_base',timezone:'Australia/Brisbane',report_date:macroStale?'2000-01-01':new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane'}).format(new Date()),generated_at:new Date().toISOString(),macro_score:55,macro_regime:'Mixed'}});
  }
  if(outage)return r.fulfill({status:503,json:{ok:false}});
  const trade={pair:'BTC/USDT:USDT',direction:'LONG',leverage:1,open_rate:60000,current_rate:61000,stake_amount:1000,profit_abs:8.33,profit_pct:1.67,open_date:new Date().toISOString()};
  return r.fulfill({json:{ok:true,demo:wrong?'medium':'short',generated_at:Date.now()/1000-(stale?60:0),bot:{pairs:['BTC','ETH','SOL','XRP','LINK','ONDO','AAVE','UNI','HYPE','INJ'].map(a=>a+'/USDT:USDT'),strategy:'Short Term 15m',exchange:'bybit',timeframe:'15m',mode:'PAPER',state:'RUNNING',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,stake_currency:'USDT',stake_amount:1000,max_open_trades:3,version:'test'},portfolio:{starting_balance:missing?null:10000,profit_closed_abs:0,profit_closed_pct:0,profit_all_abs:20,profit_all_pct:0.2,open_positions:empty?0:2,max_open_positions:3,winning_trades:0,losing_trades:0},open_trades:empty?[]:[trade,{...trade,pair:'ETH/USDT:USDT',direction:'SHORT',profit_abs:-2,profit_pct:-0.4}],history:empty?[]:[{...trade,direction:'SHORT',close_rate:59000,exit_reason:'roi',close_date:new Date().toISOString()}]}});
 });
 await page.goto('http://localhost:8765/demo/short/');
 await page.waitForFunction(()=>document.querySelector('#stateBadge').textContent==='RUNNING');
 assert.equal(await page.locator('h1').innerText(),'Live bot demo · Short Term 15m');
 assert.match(await page.locator('#pairUniverse').innerText(),/INJ\/USDT:USDT/);
 assert.equal(await page.locator('#settings .setting b').first().innerText(),'Short Term 15m');
 assert.match(await page.locator('#settings').innerText(),/bybit/);
 assert.match(await page.locator('#settings').innerText(),/15m/);
 assert.equal(await page.locator('#openPos').innerText(),'2 / 3');
 assert.equal(await page.locator('#settings .setting b').nth(3).innerText(),'1,000.00 USDT');
 await page.waitForFunction(()=>document.querySelector('#demo-macro-score').textContent==='55 / 100');
 assert.equal(await page.locator('#demo-macro-regime').innerText(),'Mixed');
 assert(await page.evaluate(()=>document.querySelector('.demo-macro').getBoundingClientRect().bottom<document.querySelector('.grid').getBoundingClientRect().top));
 assert.match(await page.locator('#profit').innerText(),/0\.00 USDT/);
 assert.equal(await page.locator('#openRows tr').count(),2);
 assert.deepEqual(await page.locator('#openRows tr td:nth-child(2)').allTextContents(),['LONG','SHORT']);
 assert.deepEqual(await page.locator('#openRows tr td:nth-child(3)').allTextContents(),['1×','1×']);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Short demo overflow '+width);
  await page.screenshot({path:path.join(os.tmpdir(),`rrr-short-demo-${width}.png`),fullPage:true});
 }
 empty=true;await page.evaluate(()=>load());
 assert.equal(await page.locator('#openEmpty').innerText(),'No open trades.');
 missing=true;await page.evaluate(()=>load());assert.equal(await page.locator('#balance').innerText(),'—');
 stale=true;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'UNAVAILABLE');
 assert.match(await page.locator('#updated').innerText(),/stale/);
 assert.equal(await page.locator('#openRows tr').count(),0);
 stale=false;wrong=true;await page.evaluate(()=>load());assert.equal(await page.locator('#settings .setting').count(),0);
 wrong=false;outage=true;await page.evaluate(()=>load());assert.equal(await page.locator('#historyRows tr').count(),0);
 outage=false;empty=false;missing=false;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'RUNNING');
 const refreshMacro=async()=>{await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForTimeout(300);};
 macroStale=true;await refreshMacro();assert.equal(await page.locator('#demo-macro-score').innerText(),'N/A');
 assert.match(await page.locator('#demo-macro-regime').innerText(),/Stale/);
 macroStale=false;macroOutage=true;await refreshMacro();assert.equal(await page.locator('#demo-macro-score').innerText(),'N/A');
 assert.equal(await page.locator('#stateBadge').innerText(),'RUNNING');
 macroOutage=false;await refreshMacro();assert.equal(await page.locator('#demo-macro-score').innerText(),'55 / 100');
 assert(requests.every(p=>['/api/demos/short/status','/api/reports/macro/today'].includes(p)),'Short page fetched another bot or market feed');
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: dedicated short feed, long/short positions, leverage, USDT formatting, realised zero P/L, empty/missing/stale/wrong-feed/outage/recovery and mobile/desktop layouts.');
})().catch(e=>{console.error(e);process.exitCode=1;});
