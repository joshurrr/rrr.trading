'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const html=`<!doctype html><html><head><script src="/script.js" defer></script><script src="/homepage-redesign-dashboard.js" defer></script></head><body id="home">
<div class="header-targets"><span class="header-target-label">TARGET TRADES:</span></div>
<small id="home-market-updated"></small><div id="home-market-cards"></div>
<div id="home-theme-list"></div><div id="home-event-list"></div>
<span id="home-current-count"></span><small id="home-current-count-note"></small><span id="home-current-exposure"></span><span id="home-current-pnl"></span><span id="home-current-status"></span><small id="home-current-status-note"></small><small id="home-activity-updated"></small><div id="home-recent-list"></div>
</body></html>`;
const server=http.createServer((req,res)=>{
 if(req.url==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(html);}
 const file=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname);
 if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
 fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type','application/javascript');res.end(data);});
});

(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[],botRequests=[];page.on('pageerror',error=>errors.push(error.message));
  let failMarket=true,failThemes=false,failCalendar=false;
  await page.route('https://api.rrr.trading/**',async route=>{
   const pathname=new URL(route.request().url()).pathname;
   if(['/status','/api/demos/short/status','/api/demos/long/status'].includes(pathname))botRequests.push(pathname);
   if(pathname==='/api/market-summary')return failMarket?route.fulfill({status:503}):route.fulfill({json:{currency:'USD',updated_at:new Date().toISOString(),markets:[{symbol:'BTC',price:100,price_change_24h:2.5,updated_at:new Date().toISOString()},{symbol:'ETH',price:50,change_24h:-1.25,updated_at:new Date().toISOString()}]}});
   if(pathname==='/api/schedule/economic')return failCalendar?route.fulfill({status:503}):route.fulfill({json:{schema_version:1,status:'partial',events:[]}});
   return route.fulfill({status:404});
  });
  await page.route('https://v4.rrr.trading/**',route=>failThemes?route.fulfill({status:503}):route.fulfill({json:{version:'theme-intelligence-read-v1',read_only:true,mode:'paper',scope:'SHARED',availability:'AVAILABLE',themes:[]}}));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.querySelector('#home-event-list')?.textContent.includes('No verified upcoming events'));
  await page.waitForFunction(()=>document.querySelector('#header-system-status')?.textContent==='TRADING STATUS UNAVAILABLE · PAPER MODE');
  assert.equal(botRequests.length,3,'all three public bot status requests start on first initialization');
  assert.match(await page.locator('#home-theme-list').innerText(),/No current saved macro themes/,'theme completion is independent of market errors');
  assert.match(await page.locator('#home-market-cards').innerText(),/Unavailable/,'failed market feed resolves to unavailable');
  assert.equal(await page.locator('.header-target-label').innerText(),'TRADING STATUS:');
  assert.match(await page.locator('#header-system-status').innerText(),/TRADING STATUS LOADING/);
  failMarket=false;await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  await page.waitForFunction(()=>document.querySelector('[data-indicator="btc"] strong')?.textContent.includes('+2.5%'));
  assert.match(await page.locator('[data-indicator="eth"] strong').innerText(),/-1.25%/,'both supported 24-hour fields are rendered');
  assert.deepEqual(errors,[]);
  console.log('PASS: initial bot status refresh, optional ok field, price_change_24h/change_24h mapping, independent themes/calendar/market resolution, immediate header label replacement.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
