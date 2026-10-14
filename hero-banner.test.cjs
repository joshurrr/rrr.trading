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
  fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/html');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let regime='bearish',stale=false,expired=false,failure=false,calls=0,shell=false;
  await page.route('**/radio-navigation.js*',r=>shell?r.fallback():r.fulfill({contentType:'application/javascript',body:''}));
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{
   if(new URL(r.request().url()).pathname!='/api/trading-context')return r.fulfill({status:503});
   calls++;if(failure)return r.fulfill({status:503});
   return r.fulfill({json:{mode:'observation_only',fresh:true,generated_at:new Date(Date.now()-(stale?720000:0)).toISOString(),crypto:{available:true,fresh:true,regime,confidence:83,valid_until:new Date(Date.now()+(expired?-1000:600000)).toISOString()}}});
  });
  const base='http://127.0.0.1:'+server.address().port;
  await page.goto(base);await page.waitForFunction(()=>document.querySelector('.header-sentiment').textContent==='BEARISH');
  assert.equal(calls,1);assert.equal(await page.locator('.header-hero-title').count(),0);
  for(const [time,expected] of [
   ['2026-01-12T13:00:00Z','LONDON & NEW YORK'],
   ['2026-03-09T12:30:00Z','LONDON & NEW YORK'],
   ['2026-07-13T07:30:00Z','TOKYO & LONDON'],
   ['2026-01-12T00:00:00Z','ASIA SESSION'],
   ['2026-01-12T18:00:00Z','US SESSION'],
   ['2026-01-17T13:00:00Z','SATURDAY SESSION']
  ])assert.equal(await page.evaluate(t=>SiteHeader.sessionName(new Date(t)),time),expected);
  assert.match(await page.locator('.header-session-title').innerText(),new RegExp(await page.evaluate(()=>new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',weekday:'long'}).format(new Date()).toUpperCase())+' – '));
  const selection=()=>({schema_version:1,status:'ok',universe_version:'hero-test',generated_at:new Date().toISOString(),valid_until:new Date(Date.now()+600000).toISOString(),assets:['BTC','ETH','SOL','XRP','LINK','ONDO','AAVE','UNI','HYPE','INJ'].map((symbol,i)=>({symbol,pair:symbol+'/USDT:USDT',rank:i+1,opportunity_score:80-i,reason:'Saved selection'}))});
  await page.evaluate(d=>SiteHeader.renderAssets(d),selection());
  assert.equal(await page.locator('.header-asset').count(),10);
  await page.locator('.header-asset').first().click();await page.waitForFunction(()=>document.querySelector('dialog[open]'));await page.keyboard.press('Escape');
  for(const value of ['bullish','strong_bullish','neutral','mixed','unknown','strong_bearish','bearish']){
   regime=value;await page.evaluate(()=>refreshHomepageIntelligence());
   assert.equal(await page.locator('.header-sentiment').innerText(),value==='unknown'?'UNAVAILABLE':value.replaceAll('_',' ').toUpperCase());
   if(value!=='unknown')assert.equal(await page.locator('.header-sentiment').innerText(),await page.locator('#intelligence-regime').innerText());
   if(value.startsWith('strong_'))assert.equal(await page.locator('.header-sentiment').getAttribute('data-sentiment'),value.slice(7).toUpperCase());
  }
  stale=true;await page.evaluate(()=>refreshHomepageIntelligence());assert.equal(await page.locator('.header-sentiment').innerText(),'UNAVAILABLE');
  stale=false;expired=true;await page.evaluate(()=>refreshHomepageIntelligence());assert.equal(await page.locator('.header-commentary').innerText(),'We find assets and automatically trade them during this program');
  expired=false;failure=true;await page.evaluate(()=>refreshHomepageIntelligence());assert.equal(await page.locator('.header-sentiment').innerText(),'UNAVAILABLE');failure=false;
  await page.evaluate(()=>refreshHomepageIntelligence());
  await page.evaluate(()=>SiteHeader.renderSentiment('BULLISH',Date.now()+50));await page.waitForTimeout(100);assert.equal(await page.locator('.header-sentiment').innerText(),'UNAVAILABLE');
  await page.evaluate(()=>refreshHomepageIntelligence());
  for(const width of [320,375,768,1440]){
   await page.setViewportSize({width,height:900});
   assert(await page.locator('[data-site-header]').evaluate(el=>el.scrollWidth<=innerWidth),'Hero overflow '+width);
   await page.screenshot({path:path.join(__dirname,'.runtime','hero-'+width+'.png')});
  }
  shell=true;await page.goto(base+'/radio-shell.html');await page.waitForFunction(()=>document.querySelector('.header-sentiment').textContent==='BEARISH');
  await page.evaluate(()=>SiteNavigation.load('/schedule/'));await page.waitForTimeout(500);
  assert.equal(await page.locator('.header-sentiment').innerText(),'BEARISH');
  await page.evaluate(()=>SiteHeader.renderSentiment('BEARISH',Date.now()+50));await page.waitForTimeout(100);assert.equal(await page.locator('.header-sentiment').innerText(),'UNAVAILABLE');
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  for(const route of ['/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/','/tools/','/bots/']){
   await page.evaluate(route=>SiteNavigation.load(route),route);await page.waitForTimeout(300);
   assert.equal(await page.locator('.header-sentiment').innerText(),'UNAVAILABLE');
   assert(await page.locator('#radio-audio').evaluate(a=>a.paused&&!a.autoplay));
  }
  // Cached pre-redesign markup must retain compact bubbles with the new CSS.
  await page.route('**/site-header.js*',r=>r.fulfill({contentType:'application/javascript',body:require('node:child_process').execFileSync('git',['show','e718f7b^:site-header.js'],{encoding:'utf8'})}));
  await page.setViewportSize({width:1440,height:900});await page.goto(base+'/radio-shell.html');
  await page.evaluate(d=>SiteHeader.renderAssets(d),selection());
  assert(await page.locator('.header-asset').evaluateAll(buttons=>buttons.every(b=>b.getBoundingClientRect().width<120)),'Cached markup bubbles must stay compact');
  assert((await page.locator('.site-header').boundingBox()).height<220,'Cached markup must keep compact hero height');
  assert.deepEqual(errors,[]);
  console.log('PASS: hero sentiment states, shared validated context, stale/expired/failure/clock expiry, Brisbane day, ten clickable bubbles/dialog, persistent shell, four widths, no extra polling.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
