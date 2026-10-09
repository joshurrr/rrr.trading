const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const pages=['/','/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/','/about.html','/reports/2026-09-27.html','/reports/2026-09-28.html','/reports/2026-09-29.html','/website/demo/'];
const symbols=['BTC','ETH','XRP','SOL','ADA','DOGE','LINK','AVAX','NEAR','SUI'];
const sessionCases=[
 ['2026-01-12T00:00:00Z','ASIA SESSION'],
 ['2026-01-12T07:59:59Z','ASIA SESSION'],
 ['2026-01-12T08:00:00Z','EUROPE SESSION'],
 ['2026-01-12T12:59:59Z','EUROPE SESSION'],
 ['2026-01-12T13:00:00Z','GLOBAL OVERLAP'],
 ['2026-01-12T16:59:59Z','GLOBAL OVERLAP'],
 ['2026-01-12T17:00:00Z','US SESSION'],
 ['2026-01-12T21:59:59Z','US SESSION'],
 ['2026-01-12T22:00:00Z','OVERNIGHT SESSION'],
 ['2026-10-09T23:59:59Z','OVERNIGHT SESSION'],
 ['2026-10-10T00:00:00Z','SATURDAY SESSION'],
 ['2026-10-10T13:00:00Z','SATURDAY SESSION'],
 ['2026-10-10T23:59:59Z','SATURDAY SESSION'],
 ['2026-10-11T00:00:00Z','SUNDAY SESSION'],
 ['2026-10-11T13:00:00Z','SUNDAY SESSION'],
 ['2026-10-11T23:59:59Z','SUNDAY SESSION'],
 ['2026-10-12T00:00:00Z','ASIA SESSION'],
 // US spring/autumn changes, including weeks with different UK/US offsets.
 ['2026-03-06T12:30:00Z','EUROPE SESSION'],
 ['2026-03-09T12:30:00Z','GLOBAL OVERLAP'],
 ['2026-10-30T12:30:00Z','GLOBAL OVERLAP'],
 ['2026-11-02T12:30:00Z','EUROPE SESSION'],
 // UK spring/autumn changes: opening and closing both move in UTC.
 ['2026-03-27T07:30:00Z','ASIA SESSION'],
 ['2026-03-30T07:30:00Z','EUROPE SESSION'],
 ['2026-03-27T16:30:00Z','GLOBAL OVERLAP'],
 ['2026-03-30T16:30:00Z','US SESSION'],
 ['2026-10-23T07:30:00Z','EUROPE SESSION'],
 ['2026-10-26T07:30:00Z','ASIA SESSION'],
 ['2026-10-23T16:30:00Z','US SESSION'],
 ['2026-10-26T16:30:00Z','GLOBAL OVERLAP'],
 // UTC Monday starts Asia even though New York still has local Sunday.
 ['2026-07-13T00:00:00Z','ASIA SESSION'],
 ['2026-07-13T20:59:59Z','US SESSION'],
 ['2026-07-13T21:00:00Z','OVERNIGHT SESSION']
];
const universe={schema_version:1,status:'ok',universe_version:'shared-hero-fixture',generated_at:new Date().toISOString(),valid_until:new Date(Date.now()+600000).toISOString(),assets:symbols.map((symbol,i)=>({rank:i+1,symbol,pair:symbol+'/USDT:USDT',opportunity_score:70-i,reason:'Saved selection',timeframes:{'15m':{eligible:i===0},'1h':{eligible:i===1},'4h':{eligible:i===2}}}))};
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const file=path.resolve(__dirname,'.'+(name.endsWith('/')?name+'index.html':name));
 if(name.split('/').some(p=>p.startsWith('.'))||!file.startsWith(__dirname+path.sep)||!/[.](html|css|js|png|jpg|jpeg|svg|ico|webp|json|woff2?)$/i.test(file))return res.writeHead(403).end();
 fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(data);});
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  for(const url of pages){
   const page=await browser.newPage({timezoneId:url.includes('1hrbot')?'America/Los_Angeles':'Australia/Sydney'}),errors=[];let universeRequests=0;
   await page.clock.install();
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('https://stream.radiorrr.com/**',r=>r.abort());
   await page.route('https://api.rrr.trading/**',r=>{const p=new URL(r.request().url()).pathname;if(p==='/api/trading-universe'){universeRequests++;return r.fulfill({json:universe});}return r.fulfill({status:503,json:{status:'unavailable'}});});
   await page.goto(`http://127.0.0.1:${server.address().port}${url}`);
   await page.waitForFunction(()=>document.querySelectorAll('.header-asset').length===10);
   assert.deepEqual(await page.locator('.header-asset').allTextContents(),symbols,url);
   assert.equal(universeRequests,1,`${url}: one feed owner`);
   const title=await page.locator('.header-hero-title').innerText();assert.match(title,/^LIVE CRYPTO PERPETUALS — (ASIA SESSION|EUROPE SESSION|GLOBAL OVERLAP|US SESSION|OVERNIGHT SESSION|SATURDAY SESSION|SUNDAY SESSION)$/);
   assert.equal(await page.locator('.header-session-note').innerText(),'Global trading activity varies by region. Crypto perpetual markets operate 24/7.');
   assert.equal(await page.locator('.header-program-subtitle').innerText(),'TOP 10 TRADING CANDIDATES');
   if(url==='/'){assert.equal(await page.locator('#universe-title').innerText(),'TOP 10 TRADING CANDIDATES');assert.equal(await page.locator('#top-opportunities .eyebrow').innerText(),'LIVE CRYPTO DERIVATIVES SCANNER');}
   for(const [time,expected] of sessionCases)assert.equal(await page.evaluate(t=>SiteHeader.sessionName(new Date(t)),time),expected,`${url}: ${time}`);
   for(const width of [320,375,768,1024,1440]){
    await page.setViewportSize({width,height:950});
    assert.equal(await page.locator('[data-site-header]').evaluate(el=>[...el.querySelectorAll('header,nav,.header-hero-title,.header-program-subtitle,.header-assets,.header-session-note')].every(n=>{const b=n.getBoundingClientRect();return b.left>=-1&&b.right<=innerWidth+1&&n.scrollWidth<=n.clientWidth+1;})),true,`${url}: header fits ${width}`);
   if(url==='/')assert(await page.locator('#top-opportunities .section-heading').evaluate(n=>[...n.querySelectorAll('h2,.eyebrow,.macro-state')].every(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&e.scrollWidth<=e.clientWidth+1;})),`${url}: section heading fits`);
   }
   if(pages.indexOf(url)<4){
    for(const session of [...new Set(sessionCases.map(c=>c[1]))]){
     const time=sessionCases.find(c=>c[1]===session)[0];
     await page.clock.setSystemTime(new Date(time));
     await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
     assert.equal(await page.locator('.header-hero-title').innerText(),'LIVE CRYPTO PERPETUALS — '+session);
     for(const width of [320,375,768,1440]){
      await page.setViewportSize({width,height:950});
      assert(await page.locator('.header-hero-title').evaluate(n=>{const b=n.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth&&n.scrollWidth<=n.clientWidth+1;}),`${url}: ${session} ${width}`);
     }
    }
    for(const [before,after] of [['2026-01-12T12:59:59Z','GLOBAL OVERLAP'],['2026-10-09T23:59:59Z','SATURDAY SESSION'],['2026-10-10T23:59:59Z','SUNDAY SESSION'],['2026-10-11T23:59:59Z','ASIA SESSION']]){
     await page.clock.setSystemTime(new Date(before));
     await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
     await page.clock.runFor(60000);
     assert.equal(await page.locator('.header-hero-title').innerText(),'LIVE CRYPTO PERPETUALS — '+after,`${url}: automatic transition ${before}`);
    }
    await page.clock.setSystemTime(new Date());
    await page.evaluate(u=>SiteHeader.renderAssets(u),universe);
   }
   if(url==='/'||url==='/demo/15minbot/'){fs.mkdirSync(path.join(__dirname,'.runtime'),{recursive:true});for(const width of [320,1440]){await page.setViewportSize({width,height:950});await page.locator('[data-site-header]').screenshot({path:path.join(__dirname,`.runtime/shared-hero-preview-${url==='/'?'home':'bot'}-${width}.png`)});}}
   await page.locator('.header-asset').first().click();await page.locator('dialog[open]').waitFor();await page.keyboard.press('Escape');assert.equal(await page.locator('dialog[open]').count(),0);
   await page.evaluate(u=>SiteHeader.renderAssets({...u,status:'stale'}),universe);assert.match(await page.locator('.header-asset-note').innerText(),/stale/);
   await page.evaluate(u=>SiteHeader.renderAssets({...u,assets:[...u.assets.slice(0,9),u.assets[0]]}),universe);assert.equal(await page.locator('.header-asset').count(),0);assert.match(await page.locator('#header-assets').innerText(),/unavailable/);
   await page.evaluate(u=>SiteHeader.renderAssets(u),universe);assert.equal(await page.locator('.header-asset').count(),10);
   assert.deepEqual(errors,[],url);await page.close();
  }
  console.log('PASS: seven crypto headings, regional/UTC weekend boundaries, UK/US DST, automatic refresh, visitor timezone independence; shared Top 10 across nine pages, single feed ownership, five widths, modal/Escape, stale/unavailable/recovery and no page errors.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
