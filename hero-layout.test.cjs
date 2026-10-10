const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':file.endsWith('.webp')?'image/webp':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const live=process.env.RRR_HERO_BASE_URL,base=live||`http://127.0.0.1:${server.address().port}`;
  const widths=[1920,1440,1366,1024,768,390,375,320];
  const routes=['/','/schedule/','/bots/','/tools/','/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/','/about.html','/reports/2026-09-27.html','/reports/2026-09-28.html','/reports/2026-09-29.html','/website/demo/'];
  if(!live){
   await page.route('https://api.rrr.trading/**',r=>new URL(r.request().url()).pathname==='/api/trading-universe'?r.fulfill({json:{schema_version:1,status:'ok',universe_version:'hero-fixture',generated_at:new Date().toISOString(),valid_until:new Date(Date.now()+3600000).toISOString(),assets:'BTC ETH 1000PEPE XRP LINK ONDO AAVE UNI HYPE INJ'.split(' ').map((symbol,i)=>({symbol,pair:symbol+'/USDT:USDT',rank:i+1,opportunity_score:80-i,reason:'Saved evidence'}))}}):r.fulfill({status:503,json:{}}));
  }
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  fs.mkdirSync('.runtime/hero',{recursive:true});
  for(const route of routes){
   console.log('Checking '+route);await page.goto(base+route);await page.waitForFunction(()=>document.querySelectorAll('.header-asset').length===10);
   assert.equal(await page.locator('.header-hero-title').innerText(),'LIVE CRYPTO PERPETUALS');
   if(route==='/'){
    assert.equal(await page.locator('.header-session-note').count(),0);
    assert.equal(await page.locator('.header-session-row .header-program-subtitle').innerText(),'TOP 10 CANDIDATES');
   }
   assert.equal(await page.locator('.header-session-title').innerText(),await page.evaluate(()=>SiteHeader.sessionName()));
   assert.deepEqual(await page.locator('.operating-modes .mode-button').allTextContents(),['LIVE ANALYSIS','SCHEDULE','TRADING BOTS','TOOLS']);
   assert(await page.locator('#radio-audio').evaluate(a=>a.paused&&!a.autoplay));
   for(const width of widths){
    await page.setViewportSize({width,height:1000});
    const result=await page.locator('.site-header').evaluate(h=>{
     const rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
     const content=h.querySelector('.header-content'),brand=h.querySelector('.brand'),tools=h.querySelector('.header-tools');
     return {hero:rect(h),content:rect(content),brand:rect(brand),radio:rect(tools),overflow:h.scrollWidth>h.clientWidth+1,inside:[...h.querySelectorAll('.header-asset,.header-hero-title,.header-session-title,.header-session-note,.radio button,.radio strong,.header-note')].every(e=>{const r=rect(e),p=rect(h);return r.left>=p.left&&r.right<=p.right&&r.top>=p.top&&r.bottom<=p.bottom;}),pulse:getComputedStyle(h.querySelector('#radio-toggle')).animationName};
    });
    assert(!result.overflow&&result.inside,`${route} hero bounds at ${width}`);
    assert.equal(result.pulse,'radio-neon-pulse');
    if(route==='/'){
     assert(result.brand.right<=result.radio.left||result.brand.bottom<=result.radio.top,'logo/player collision');
     assert(result.brand.right<=result.content.left||result.brand.bottom<=result.content.top,'logo/content collision');
     const layout=await page.locator('.header-content').evaluate(c=>{
      const title=c.querySelector('.header-hero-title'),row=c.querySelector('.header-session-row'),assets=c.querySelector('.header-assets');
      return {aligned:[title,row,assets].every(e=>Math.abs(e.getBoundingClientRect().left-c.getBoundingClientRect().left)<1),gap:assets.getBoundingClientRect().top-row.getBoundingClientRect().bottom};
     });
     assert(layout.aligned&&layout.gap<=9,'compact left-aligned rows');
     if(width>=1366){assert(result.brand.width>=280,'larger desktop logo');assert(result.hero.height<=180,'25px shorter desktop hero');}
    }
    if(width>900){
     assert(result.brand.right<result.content.left&&result.content.right<result.radio.left,`${route} three columns at ${width}`);
     assert(Math.abs((result.brand.top+result.brand.bottom)/2-(result.hero.top+result.hero.bottom)/2)<2);
     assert(Math.abs((result.content.top+result.content.bottom)/2-(result.hero.top+result.hero.bottom)/2)<2);
     assert(result.radio.top-result.hero.top>=18&&result.radio.top-result.hero.top<=24);
     if(width>=1366)assert(result.hero.height<=215,`compact desktop ${result.hero.height}`);
    }
    assert(await page.locator('.header-note').isVisible());
    assert(await page.locator('.radio strong').isVisible());
    assert(await page.locator('.operating-modes').evaluate((nav)=>nav.getBoundingClientRect().top>=document.querySelector('.site-header').getBoundingClientRect().bottom));
    if(route==='/'||route==='/demo/1hrbot/'&&[390,1366].includes(width))await page.locator('[data-site-header]').screenshot({path:`.runtime/hero/${live?'live':'local'}-${route==='/'?'home':'1h'}-${width}.png`});
   }
   await page.locator('.header-asset').first().click();await page.waitForSelector('#asset-intelligence-dialog[open]');await page.keyboard.press('Escape');
  }
  // Existing session calculation, including UTC weekends and regional DST.
  assert.deepEqual(await page.evaluate(()=>['2026-10-10T12:00:00Z','2026-10-11T12:00:00Z','2026-10-12T01:00:00Z','2026-10-12T09:00:00Z','2026-10-12T14:00:00Z','2026-10-12T19:00:00Z','2026-10-12T23:00:00Z','2026-11-02T14:00:00Z'].map(d=>SiteHeader.sessionName(new Date(d)))),['SATURDAY SESSION','SUNDAY SESSION','ASIA SESSION','EUROPE SESSION','GLOBAL OVERLAP','US SESSION','OVERNIGHT SESSION','GLOBAL OVERLAP']);
  await page.evaluate(()=>{const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-12T14:00:00Z']));}static now(){return RealDate.now();}};document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await page.locator('.header-session-title').innerText(),'GLOBAL OVERLAP');
  // Drive the existing media event/control path without depending on a live stream.
  await page.evaluate(()=>{const a=document.querySelector('#radio-audio');let paused=true;Object.defineProperty(a,'paused',{get:()=>paused});a.play=async()=>{paused=false;a.dispatchEvent(new Event('playing'));};a.pause=()=>{paused=true;a.dispatchEvent(new Event('pause'));};});
  await page.locator('#radio-toggle').click();assert.equal(await page.locator('#radio-toggle').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#radio-toggle').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.locator('#radio-toggle').click();assert.equal(await page.locator('#radio-toggle').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('#radio-toggle').evaluate(e=>getComputedStyle(e).animationName),'radio-neon-pulse');
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#radio-toggle').evaluate(e=>getComputedStyle(e).animationName),'none');
  if(!live){
   await page.evaluate(()=>SiteHeader.renderAssets({schema_version:1,status:'stale',universe_version:'old',generated_at:new Date(Date.now()-7200000).toISOString(),valid_until:new Date(Date.now()-3600000).toISOString(),assets:Array.from({length:10},(_,i)=>({symbol:'LONGTICKER'+i,pair:'LONGTICKER'+i+'/USDT:USDT',rank:i+1,opportunity_score:50,reason:'Saved evidence'}))}));
   assert.match(await page.locator('#header-assets').innerText(),/stale selection/);
   await page.setViewportSize({width:320,height:1000});assert(await page.locator('.site-header').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
   await page.evaluate(()=>SiteHeader.renderAssets(null));assert.equal(await page.locator('#header-assets').innerText(),'Top 10 selection unavailable');
  }
  assert.deepEqual(errors,[]);console.log(`PASS ${live?'live':'local'} hero: ${routes.length} shared pages; ${widths.join('/')}; geometry, dynamic sessions, candidates/dialog, radio controls/pulse/reduced motion, unchanged navigation and honest data states.`);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
