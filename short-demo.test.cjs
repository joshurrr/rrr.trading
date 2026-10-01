const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
(async () => {
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage();
 const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 let outage=false,stale=false,wrong=false,empty=false,missing=false;
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{
  requests.push(new URL(r.request().url()).pathname);
  if(outage)return r.fulfill({status:503,json:{ok:false}});
  const trade={pair:'BTC/USDT:USDT',direction:'LONG',leverage:1,open_rate:60000,current_rate:61000,stake_amount:500,profit_abs:8.33,profit_pct:1.67,open_date:new Date().toISOString()};
  return r.fulfill({json:{ok:true,demo:wrong?'medium':'short',generated_at:Date.now()/1000-(stale?60:0),bot:{strategy:'Short 15 min',exchange:'bybit',timeframe:'15m',mode:'PAPER',state:'RUNNING',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,stake_currency:'USDT',stake_amount:500,max_open_trades:3,version:'test'},portfolio:{starting_balance:missing?null:10000,profit_closed_abs:0,profit_closed_pct:0,profit_all_abs:20,profit_all_pct:0.2,open_positions:empty?0:2,max_open_positions:3,winning_trades:0,losing_trades:0},open_trades:empty?[]:[trade,{...trade,pair:'ETH/USDT:USDT',direction:'SHORT',profit_abs:-2,profit_pct:-0.4}],history:empty?[]:[{...trade,direction:'SHORT',close_rate:59000,exit_reason:'roi',close_date:new Date().toISOString()}]}});
 });
 await page.goto('http://localhost:8765/demo/short/');
 await page.waitForFunction(()=>document.querySelector('#stateBadge').textContent==='RUNNING');
 assert.equal(await page.locator('h1').innerText(),'Short 15 min Demo');
 assert.equal(await page.locator('#settings .setting b').first().innerText(),'Short 15 min');
 assert.match(await page.locator('#settings').innerText(),/bybit/);
 assert.match(await page.locator('#settings').innerText(),/15m/);
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
 assert(requests.every(p=>p==='/api/demos/short/status'),'Short page fetched another bot feed');
 assert.deepEqual(errors,[]);
 await browser.close();
 console.log('PASS: dedicated short feed, long/short positions, leverage, USDT formatting, realised zero P/L, empty/missing/stale/wrong-feed/outage/recovery and mobile/desktop layouts.');
})().catch(e=>{console.error(e);process.exitCode=1;});
