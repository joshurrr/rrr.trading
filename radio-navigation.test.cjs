const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.RRR_RADIO_BASE_URL||`http://127.0.0.1:${server.address().port}`;
 let streams=0;
 // A real decoded long WAV tests media time continuity, rather than stubbing play().
 const pcm=Buffer.alloc(44+8000*2*180);pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(8000,24);pcm.writeUInt32LE(16000,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(pcm.length-44,40);
 await page.route('https://stream.radiorrr.com/**',r=>{streams++;return r.fulfill({contentType:'audio/wav',body:pcm});});
 if(!process.env.RRR_RADIO_BASE_URL)await page.route('https://api.rrr.trading/**',r=>{
  if(new URL(r.request().url()).pathname==='/api/trading-universe')return r.fulfill({json:{schema_version:1,status:'ok',universe_version:'radio-test',generated_at:new Date().toISOString(),valid_until:new Date(Date.now()+3600000).toISOString(),assets:'BTC ETH SOL XRP LINK ONDO AAVE UNI HYPE INJ'.split(' ').map((symbol,i)=>({rank:i+1,symbol,pair:symbol+'/USDT:USDT',opportunity_score:80-i,reason:'Saved evidence'}))}});
  return r.fulfill({status:503,json:{}});
 });
 await page.goto(base+'/');
 const content=()=>page.frameLocator('#page-content');
 const loaded=route=>page.waitForFunction(route=>{const f=document.querySelector('#page-content');return f.contentWindow.location.pathname===route&&f.contentDocument.readyState==='complete'&&!!f.contentDocument.querySelector('main');},route);
 await content().locator('#main').waitFor();
 await page.evaluate(()=>{window.originalAudio=document.querySelector('audio');window.plays=0;window.pauses=0;originalAudio.addEventListener('playing',()=>plays++);originalAudio.addEventListener('pause',()=>pauses++);});
 await page.locator('#radio-toggle').click();await page.waitForFunction(()=>!originalAudio.paused&&originalAudio.currentTime>0);
 let time=await page.evaluate(()=>originalAudio.currentTime);
 async function check(route){
  await content().locator('#main').waitFor();
  await page.waitForFunction(route=>document.querySelector('#page-content').contentWindow.location.pathname===route,route);
  assert.equal(new URL(page.url()).pathname,route);
  const state=await page.evaluate(()=>({same:originalAudio===document.querySelector('audio'),time:originalAudio.currentTime,paused:originalAudio.paused,count:document.querySelectorAll('audio').length,child:document.querySelector('#page-content').contentDocument.querySelectorAll('audio').length,plays,pauses}));
  assert(state.same);assert.equal(state.count,1);assert.equal(state.child,0);assert(!state.paused);assert(state.time>=time);time=state.time;assert.equal(state.plays,1);assert.equal(state.pauses,0);
 }
 for(const route of ['/schedule/','/bots/','/demo/15minbot/','/tools/','/']){
  if(route.startsWith('/demo/')){await page.locator('.bots-menu-toggle').click();await page.locator('#bots-shortcuts a[href="'+route+'"]').click();}
  else await page.locator('.mode-button[href="'+route+'"]').click();
  await check(route);
 }
 await page.goBack();await check('/tools/');await page.goForward();await check('/');
 await page.locator('#radio-toggle').click();await page.waitForFunction(()=>document.querySelector('#radio-toggle').getAttribute('aria-pressed')==='false');
 await page.locator('a.mode-button[href="/schedule/"]').click();await content().locator('#schedule-events').waitFor();assert(await page.evaluate(()=>originalAudio.paused));
 await content().locator('#next-week').click();
 await page.locator('#radio-toggle').click();await page.waitForFunction(()=>!originalAudio.paused);
 await page.waitForFunction(()=>document.querySelectorAll('.header-asset').length===10);await page.locator('.header-asset').first().click();await page.locator('#asset-intelligence-dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.locator('#asset-intelligence-dialog').waitFor({state:'hidden'});
 await page.evaluate(()=>{window.oldTicks=0;document.querySelector('#page-content').contentWindow.setInterval(()=>oldTicks++,20);});
 await page.locator('a.mode-button[href="/tools/"]').click();await content().locator('#main').waitFor();
 await loaded('/tools/');const ticks=await page.evaluate(()=>oldTicks);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>oldTicks),ticks,'departed page timers stop');
 for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:900});await page.locator('a.mode-button[href="/bots/"]').click();await content().locator('#main').waitFor();
  await loaded('/bots/');assert(await page.locator('#radio-toggle').isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('.bots-menu-toggle').click();await page.locator('#bots-shortcuts a[href="/demo/1hrbot/"]').click();await content().locator('#main').waitFor();
  await page.locator('.header-asset').first().click();await page.locator('#asset-intelligence-dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');await page.locator('#asset-intelligence-dialog').waitFor({state:'hidden'});
  await page.screenshot({path:path.join(__dirname,'.runtime',`radio-${width}.png`)});
 }
 assert.equal(streams,1,'one media connection across all navigation and pause/resume');assert.deepEqual(errors,[]);
 // Direct URLs and reload enter the same shell without autoplay.
 await page.goto(base+'/schedule/');await content().locator('#schedule-events').waitFor();assert(await page.locator('#radio-audio').evaluate(a=>a.paused));await page.reload();await content().locator('#schedule-events').waitFor();assert.equal(new URL(page.url()).pathname,'/schedule/');
 console.log('Radio navigation passed: decoded audio continuity, single connection, pause/resume, history, page disposal, dialogs, schedule, direct URLs/reload, four widths, no JS errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
