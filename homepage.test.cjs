const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');
(async () => {
 const browser = await chromium.launch({headless:true,channel:"msedge"});
 const page = await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 let failure=false, partial=false, empty=false;
 const asset={pair:'BTC-USDT',direction:'LONG',trade_allowed:true,confidence:78,leverage:1.5,technical_score:82,trend_score:88,sentiment_score:50,risk_score:76,risk_gate:'normal',sentiment_source:'placeholder'};
 await page.route('https://api.rrr.trading/**', route=>{
  const path=new URL(route.request().url()).pathname;
  if(failure || partial && path==='/score') return route.fulfill({status:503,body:'Unavailable'});
  const data=path==='/score'?{ok:true,assets:[asset,{...asset,pair:'SOL-USDT',trade_allowed:false,risk_gate:'blocked',leverage:0}]}:path==='/market-regime'?{ok:true,market_regime:'neutral',average_confidence:67}:{ok:true,bot:{mode:'PAPER',state:'RUNNING',strategy:'Test strategy',exchange:'Test exchange',timeframe:'4h',stake_currency:'USDT'},portfolio:{starting_balance:empty?null:1000,profit_all_abs:0,open_positions:0,max_open_positions:3,winning_trades:0,losing_trades:0}};
  return route.fulfill({json:data});
 });
 await page.goto('http://localhost:8765'); await page.waitForFunction(()=>document.querySelectorAll('#score-cards article').length===2);
 assert.match(await page.locator('#score-cards').innerText(),/SKIP/);
 assert.match(await page.locator('#sentiment-cards').innerText(),/Placeholder input/);
 await page.locator('summary').first().click(); assert.equal(await page.locator('details').first().getAttribute('open'),'');
 await page.evaluate(()=>refreshScores()); assert.equal(await page.locator('details').first().getAttribute('open'),'');
 assert.equal(await page.locator('audio').evaluate(a=>a.autoplay),false);
 assert.equal(await page.locator('audio').getAttribute('src'),'https://stream.radiorrr.com/radio.mp3');
 const demos=await page.locator('a').evaluateAll(els=>els.filter(e=>/demo/i.test(e.textContent)).map(e=>e.getAttribute('href'))); assert(demos.every(h=>h==='/demo'));
 for(const width of [1440,768,390,320]) {await page.setViewportSize({width,height:900}); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}`);}
 await page.screenshot({path:path.join(os.tmpdir(),'rrr-homepage-mobile-check.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1000}); await page.screenshot({path:path.join(os.tmpdir(),'rrr-homepage-desktop-check.png'),fullPage:true});
 empty=true; await page.evaluate(()=>refreshStatus()); assert.match(await page.locator('#bot-metrics').innerText(),/Starting balance\n—/);
 partial=true; await page.evaluate(()=>Promise.all([refreshScores(),refreshStatus()])); assert.match(await page.locator('#score-cards').innerText(),/unavailable/); assert.match(await page.locator('#bot-metrics').innerText(),/RUNNING/);
 failure=true; await page.evaluate(()=>Promise.all([refreshScores(),refreshStatus(),refreshRegime()])); assert.equal(await page.locator('#regime').innerText(),'Unavailable'); assert.doesNotMatch(await page.locator('#bot-metrics').innerText(),/RUNNING/);
 await page.goto('http://localhost:8765/demo'); await page.waitForFunction(()=>document.querySelector('#stateBadge').textContent==='UNAVAILABLE');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log('PASS: desktop/mobile 1440/768/390/320; API fixtures, blocked trades, missing values, partial/full failures, expandable details, radio defaults, demo path.');
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});
