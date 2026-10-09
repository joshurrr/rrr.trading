const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.RRR_NAV_BASE_URL||`http://127.0.0.1:${server.address().port}`;
  let scenario='healthy', release, held;
  const iso=age=>new Date(Date.now()-age*1000).toISOString();
  const assets='BTC ETH SOL XRP LINK ONDO AAVE UNI HYPE INJ'.split(' ').map((symbol,i)=>({rank:i+1,symbol,pair:symbol+'/USDT:USDT',opportunity_score:80-i,reason:'Saved test evidence'}));
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',async r=>{
   const url=new URL(r.request().url());requests.push({path:url.pathname,method:r.request().method()});
   if(url.pathname==='/api/trading-universe')return r.fulfill({json:{schema_version:1,status:'ok',universe_version:'fixture',generated_at:iso(1),valid_until:iso(-3600),assets}});
   const reporting=url.pathname.endsWith('/reporting'),native=url.pathname.endsWith('/status');
   if(!reporting&&!native)return r.fulfill({status:503,json:{}});
   if(scenario==='loading')await held;
   if(scenario==='outage'||scenario==='report-fail'&&reporting||scenario==='status-fail'&&native)return r.fulfill({status:503,json:{}});
   const bot=url.pathname.includes('/short/')?'short':url.pathname.includes('/long/')?'long':'medium';
   if(native)return r.fulfill({json:{ok:true,demo:bot,generated_at:Date.now()/1000-(scenario==='status-stale'?60:0),bot:{state:scenario==='stopped'?'STOPPED':'RUNNING',mode:scenario==='live'?'LIVE':'PAPER',version:'2026.8<script>',timeframe:scenario==='wrong-tf'?'2h':{short:'15m',medium:'1h',long:'4h'}[bot],max_open_trades:{short:5,medium:3,long:9}[bot]},portfolio:{profit_all_abs:99999},open_trades:[{}]}});
   return r.fulfill({json:{available:true,run_id:scenario==='new-run'?'next-run':'current-run<script>',started_at:iso(3600),observed_at:iso(scenario==='report-stale'?60:0),portfolio:{open_positions:scenario==='zero'?0:1,closed_trades:scenario==='zero'?0:3,win_rate:scenario==='zero'?null:scenario==='partial'?null:66.67,profit_closed_abs:scenario==='zero'?0:10,profit_open_abs:scenario==='zero'?0:-2,profit_all_abs:scenario==='partial'?null:scenario==='zero'?0:8},history:[],open_trades:[]}});
  });
  const routes=['/','/schedule/','/bots/','/tools/','/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/','/about.html','/reports/2026-09-29.html'];
  for(const route of routes){
   await page.goto(base+route);await page.waitForFunction(()=>document.querySelectorAll('.header-asset').length===10);
   const links=page.locator('.operating-modes .mode-button');assert.deepEqual(await links.allTextContents(),['LIVE ANALYSIS','SCHEDULE','TRADING BOTS','TOOLS']);
   assert.deepEqual(await links.evaluateAll(a=>a.map(x=>x.getAttribute('href'))),['/','/schedule/','/bots/','/tools/']);
   const current=page.locator('.operating-modes .mode-button[aria-current]');
   if(route==='/about.html'||route.startsWith('/reports/'))assert.equal(await current.count(),0);else assert.equal(await current.getAttribute('href'),route.startsWith('/demo/')?'/bots/':route);
   assert.match(await page.locator('.header-hero-title').innerText(),/^LIVE CRYPTO PERPETUALS/);assert.equal(await page.locator('.header-program-subtitle').innerText(),'TOP 10 TRADING CANDIDATES');
   assert(await page.locator('#radio-audio').evaluate(e=>e.paused&&!e.autoplay));
   for(const width of [320,375,768,1024,1440,1920]){
    await page.setViewportSize({width,height:1000});assert(await page.locator('.operating-modes').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    assert(await links.evaluateAll(a=>a.every(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('span:last-child').getBoundingClientRect();return s.left>=r.left&&s.right<=r.right+1;})),'nav labels fit '+route+' '+width);
    if(!route.startsWith('/demo/'))assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),route+' overflow '+width);
    await page.locator('.bots-menu-toggle').click();assert(await page.locator('#bots-shortcuts').isVisible());
    assert.deepEqual(await page.locator('#bots-shortcuts a').allTextContents(),['ALL TRADING BOTS','15 MIN BOT','1 HR BOT','4 HR BOT']);
    assert(await page.locator('#bots-shortcuts').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
    await page.keyboard.press('Escape');assert.equal(await page.locator('.bots-menu-toggle').getAttribute('aria-expanded'),'false');
   }
   await page.locator('.bots-menu-toggle').focus();await page.keyboard.press('ArrowDown');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'ALL TRADING BOTS');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'15 MIN BOT');await page.keyboard.press('Escape');assert(await page.locator('.bots-menu-toggle').evaluate(e=>e===document.activeElement));
   await page.locator('.header-asset').first().click();await page.waitForSelector('#asset-intelligence-dialog[open]');assert.match(await page.locator('#ai-title').innerText(),/BTC/);await page.keyboard.press('Escape');
  }
  for(const route of ['/','/schedule/','/bots/','/tools/']){await page.goto(base+'/bots/');await page.locator(`.mode-button[href="${route}"]`).click();assert.equal(new URL(page.url()).pathname,route);}
  for(const route of ['/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/']){await page.goto(base+'/bots/');await page.locator('.bots-menu-toggle').click();await page.locator(`#bots-shortcuts a[href="${route}"]`).click();assert.equal(new URL(page.url()).pathname,route);assert.equal(await page.locator('.mode-button[aria-current]').getAttribute('href'),'/bots/');}
  // Touch shortcut disclosure and outside dismissal.
  const touch=await browser.newContext({hasTouch:true,viewport:{width:375,height:900}}),touchPage=await touch.newPage();await touchPage.route('https://api.rrr.trading/**',r=>r.fulfill({status:503,json:{}}));await touchPage.goto(base+'/schedule/');await touchPage.locator('.bots-menu-toggle').tap();assert(await touchPage.locator('#bots-shortcuts').isVisible());await touchPage.locator('.header-hero-title').tap();assert(!await touchPage.locator('#bots-shortcuts').isVisible());await touch.close();
  for(scenario of ['healthy','zero','partial','report-fail','report-stale','status-fail','status-stale','wrong-tf','stopped','live','outage','new-run']){
   requests.length=0;await page.goto(base+'/bots/');await page.waitForFunction(()=>![...document.querySelectorAll('#bot-cards dd')].some(e=>e.textContent.includes('Loading')));
   const cards=page.locator('.bot-overview-card');assert.equal(await cards.count(),3);
   assert.equal(await page.locator('#bot-cards script').count(),0);assert.doesNotMatch(await page.locator('#bot-cards').innerText(),/99,999/);
   const values=await cards.first().locator('dd').allTextContents();
   if(['report-fail','report-stale','outage','live'].includes(scenario)){assert.equal(values[7],'Unavailable');assert.equal(values[11],'Unavailable');}
   else if(scenario==='zero'){assert.equal(values[4],'0');assert.equal(values[7],'0');assert.equal(values[8],'Unavailable');assert.equal(values[9],'0.00 USDT');}
   else {assert.equal(values[7],'3');assert.equal(values[9],'10.00 USDT');assert.equal(values[10],'-2.00 USDT');assert.equal(values[11],scenario==='partial'?'Unavailable':'8.00 USDT');}
   if(scenario==='new-run')assert.equal(values[2],'next-run');
   if(scenario==='stopped')assert.match(await cards.first().innerText(),/Process: Stopped/);
   if(['status-fail','status-stale','wrong-tf','outage'].includes(scenario))assert.doesNotMatch(await cards.first().innerText(),/Process: Running/);
   assert.equal(values[6],'Unknown · see bot evidence');
   assert.equal(requests.filter(r=>r.path.endsWith('/reporting')).length,3);assert.equal(requests.filter(r=>r.path.endsWith('/status')).length,3);
   for(const width of [320,375,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(scenario==='healthy'&&[375,1440].includes(width))await page.screenshot({path:`.runtime/navigation-bots-${width}.png`,fullPage:true});}
  }
  scenario='loading';held=new Promise(r=>release=r);await page.goto(base+'/bots/');assert.match(await page.locator('#bot-cards').innerText(),/Loading/);release();await page.waitForFunction(()=>document.querySelector('.bot-overview-card dd').textContent==='PAPER');
  scenario='healthy';await page.reload();await page.waitForFunction(()=>document.querySelector('.bot-overview-card dd').textContent==='PAPER');await page.evaluate(()=>{const old=Date.now;Date.now=()=>old()+61000;});await page.waitForTimeout(1100);assert.doesNotMatch(await page.locator('#bot-cards').innerText(),/Process: Running|8.00 USDT/);
  // Scale the presentation grid without adding fictional production bots.
  await page.reload();await page.evaluate(()=>{const root=document.querySelector('#bot-cards'),card=root.firstElementChild;for(let i=0;i<9;i++)root.append(card.cloneNode(true));});for(const width of [320,375,768,1024,1440,1920]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
  await page.goto(base+'/schedule/');assert.match(await page.locator('h1').innerText(),/GLOBAL MARKET SCHEDULE/);assert.match(await page.locator('main').innerText(),/Phase 2/);assert.equal(await page.locator('main time').count(),0);
  for(const width of [375,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`.runtime/navigation-schedule-${width}.png`,fullPage:true});}
  await page.locator('#radio-audio').evaluate(a=>{a.play=()=>Promise.reject(Error('Fixture failure'));});await page.locator('#radio-toggle').click();await page.waitForFunction(()=>document.querySelector('#radio-status').textContent.includes('unavailable'));
  assert.deepEqual(errors,[]);assert(requests.every(r=>r.method==='GET'));console.log('PASS Phase 1: four routes/all pages, active bot group, touch/keyboard/Escape/outside submenu, preserved sessions/10 bubbles/modal/radio, current-run metrics/no legacy fallback, missing/stale/expiry/loading/partial/zero/mode/run changes, one request per feed, safe text, scalable cards, 320/375/768/1024/1440/1920, GET-only/no errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
