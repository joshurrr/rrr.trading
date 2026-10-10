const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
// Fixtures exercise presentation only. Decorative candles are never price data.
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.join(__dirname,new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
  let assets='BTC ETH SOL XRP ZZZNEW ABCDEFGHIJKLMNOPQRST LINK ONDO HYPE INJ'.split(' ').map((symbol,i)=>({rank:i+1,symbol,pair:symbol+'/USDT:USDT',opportunity_score:71.2-i,trend:i===1?'negative':i===2?'mixed':'positive',reason:'Strong saved context. Missing evidence remains in selection details. <img src=x onerror=alert(1)>',data_confidence:.5,approved_for_new_entries:true}));
  assets[0].direction='LONG';assets[0].selected_timeframe='15m';assets[1].direction='SHORT';assets[1].selected_timeframe='1h';
  const data=()=>({schema_version:1,status:'ok',universe_version:'fixture',generated_at:new Date().toISOString(),valid_until:new Date(Date.now()+600000).toISOString(),entry_eligible:true,assets});
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://assets.coincap.io/**',r=>r.request().url().includes('zzznew')||r.request().url().includes('abcdefghijklmnopqrst')?r.abort():r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path fill="#c9eeff" d="M50 5 90 50 50 95 10 50Z"/></svg>'}));
  await page.route('https://api.rrr.trading/**',r=>{calls.push(new URL(r.request().url()).pathname);return new URL(r.request().url()).pathname==='/api/trading-universe'?r.fulfill({json:data()}):r.fulfill({status:503});});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.candidate-portrait');
  const cards=page.locator('#universe-assets .candidate-portrait');assert.equal(await cards.count(),10);
  assert.equal(await cards.first().locator('.universe-score').innerText(),'71.2');assert.equal(await cards.first().locator('.candidate-direction').innerText(),'LONG · 15m');
  assert.equal(await cards.nth(1).locator('.candidate-direction').innerText(),'SHORT · 1h');assert.equal(await cards.nth(2).locator('.candidate-direction').isVisible(),false);
  assert.equal(await cards.nth(4).locator('.candidate-monogram').isVisible(),true);
  assert.notEqual(await cards.nth(4).locator('button').evaluate(e=>e.style.getPropertyValue('--asset-hue')),await cards.nth(5).locator('button').evaluate(e=>e.style.getPropertyValue('--asset-hue')));
  assert.equal(await cards.first().locator('.candidate-evidence').isVisible(),false);
  await cards.first().locator('button').click();await page.waitForSelector('#asset-intelligence-dialog[open]');assert.match(await page.locator('.ai-selection').innerText(),/50% evidence confidence/);assert.match(await page.locator('.ai-selection').innerText(),/Strong saved context/);assert.equal(await page.locator('.ai-selection img').count(),0);
  await page.getByRole('button',{name:'Close asset intelligence'}).click();await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);

  await cards.first().locator('button').focus();await page.evaluate(()=>{window.originalCard=document.querySelector('.candidate-portrait');window.originalArt=originalCard.querySelector('.candidate-art');window.originalButton=document.activeElement;});
  assets[0].opportunity_score=72.3;await page.evaluate(()=>refreshTradingUniverse());
  assert(await page.evaluate(()=>originalCard===document.querySelector('.candidate-portrait')&&originalArt===originalCard.querySelector('.candidate-art')&&originalButton===document.activeElement));
  assert.equal(await cards.first().locator('.universe-score').innerText(),'72.3');
  const [first,second]=assets;assets=[{...second,rank:1},{...first,rank:2},...assets.slice(2)];await page.evaluate(()=>refreshTradingUniverse());
  assert(await page.evaluate(()=>originalCard===document.querySelectorAll('.candidate-portrait')[1]&&originalButton===document.activeElement));
  assert.equal(calls.filter(p=>p==='/api/trading-universe').length,3);assert.equal(calls.filter(p=>p==='/api/v2/intelligence/assets/BTC').length,1);
  for(const width of [320,375,768,1024,1280,1400,1440,1920]){
   await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);
   assert.equal(await cards.first().locator('button').evaluate(e=>Math.round(e.getBoundingClientRect().height)),205);
   assert(await cards.nth(5).locator('.universe-symbol').evaluate(e=>e.scrollWidth<=e.clientWidth));
   const bounds=await cards.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width}}));const count=width>=1400?7:width>=1024?5:width>=768?3:2;assert.equal(bounds.filter(r=>r.y===bounds[0].y).length,count);if(count===7){assert.equal(bounds[7].y,bounds[9].y);assert(Math.abs((bounds[7].x+bounds[9].x+bounds[9].w)/2-(bounds[0].x+bounds[6].x+bounds[6].w)/2)<2);}
   await page.locator('#top-opportunities').screenshot({path:'.runtime/candidate-cards-'+width+'.png'});
  }
  await page.setViewportSize({width:1440,height:1000});await page.locator('#top-opportunities').evaluate(e=>e.style.width='680px');assert.equal(await cards.evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().top===es[0].getBoundingClientRect().top).length),3);await page.locator('#top-opportunities').evaluate(e=>e.style.width='');
  await page.emulateMedia({reducedMotion:'reduce'});
  for(let i=0;i<10;i++){await cards.nth(i).locator('button').click();assert.equal(await page.locator('#ai-title').innerText(),assets[i].symbol);await page.evaluate(()=>refreshTradingUniverse());assert.equal(await page.locator('#ai-title').innerText(),assets[i].symbol);await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);}
await cards.first().locator('button').hover();assert.equal(await cards.first().locator('button').evaluate(e=>getComputedStyle(e).transform),'none');assert.equal(await cards.first().locator('button').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');assert.equal(await cards.first().locator('.candidate-art').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  assert.deepEqual(errors,[]);console.log('PASS: portrait scores/directions, unknown/failed logos, safe evidence, stable score refresh/reordering/focus, no added detail calls, eight widths, constrained container, all symbol dialogs, refresh isolation and reduced motion.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
