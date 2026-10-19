// Focused homepage panel checks. All remote feeds are mocked.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.route('**/radio-navigation.js*',r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>r.fulfill({status:503}));
  let state='loading',release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('https://v4.rrr.trading/**',async r=>{
   assert.equal(r.request().url(),'https://v4.rrr.trading/v4/paper');assert.equal(r.request().method(),'GET');
   assert.equal(r.request().headers().authorization,undefined);assert.equal(r.request().headers().cookie,undefined);
   requests.push(r.request().url());if(state==='loading')await gate;
   if(state==='error')return r.fulfill({status:503});
   const at=new Date(Date.now()-10000).toISOString(),end=new Date(Date.now()+(state==='expires'?1200:600000)).toISOString();
   const data={version:'paper-read-api-v1',mode:state==='live'?'live':'paper',served_at:new Date().toISOString(),
    sentiment:{availability:state==='historical'?'STALE':'AVAILABLE',context_state:state==='historical'?'CONTEXT_ONLY':state==='blocked'?'BLOCKED':'CURRENT',status:state==='fresh'||state==='expires'?'USABLE':'BLOCKED',market_direction:'UP',assessment_timestamp:at,entry_expires_at:end},
    latest_cycle:{availability:state==='stale'?'STALE':'AVAILABLE',status:'ATTENTION',started_at:at,reasons:['position_monitoring_incomplete'],monitoring:{status:'ATTENTION',unmonitored:[{symbol:'BTCUSDT'}]}},
    private_admin:{secret:'NOT_FOR_PUBLIC_PANEL'}};
   if(state==='zero')data.latest_cycle.monitoring={status:'OK',unmonitored:[]};
   if(state==='missing'){data.sentiment={availability:'UNAVAILABLE'};data.latest_cycle={availability:'UNAVAILABLE'};}
   if(state==='unsafe')data.latest_cycle.reasons=['<img src=x onerror="window.BAD=1">'];
   return r.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#v4-sentiment-state').innerText(),'LOADING');
  state='fresh';release();await page.waitForFunction(()=>document.querySelector('#v4-overview').getAttribute('aria-busy')==='false');
  assert.equal(await page.locator('#v4-sentiment-state').innerText(),'CURRENT');
  assert.match(await page.locator('#v4-sentiment-time').innerText(),/Assessed:.*AEST.*Expires:/);
  assert.match(await page.locator('#v4-paper-detail').innerText(),/1 unmonitored paper position/);
  assert.equal(await page.locator('#v4-overview article').count(),6);
  assert.equal(await page.locator('#v4-overview .v4-state').filter({hasText:'UNAVAILABLE'}).count(),4);
  assert.match(await page.locator('#v4-overview').innerText(),/Count not exposed/);
  assert(!await page.locator('#v4-overview').innerText().then(t=>t.includes('NOT_FOR_PUBLIC_PANEL')));
  assert.equal(await page.locator('#v4-overview a').getAttribute('href'),'https://v4.rrr.trading');
  assert.equal(await page.locator('[data-site-header] .brand').count(),1);
  assert.match(await page.locator('[data-site-header]').innerText(),/LIVE TRADING/);
  assert.equal(await page.locator('#radio-audio').count(),1);
  assert.equal(await page.locator('footer.site-legal-footer').count(),1);
  const artifacts=path.join(__dirname,'.runtime','v4-overview');fs.mkdirSync(artifacts,{recursive:true});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow at '+width);
   await page.screenshot({path:path.join(artifacts,'homepage-'+width+'.png'),fullPage:true});
  }
  async function refresh(next){state=next;await page.evaluate(()=>refreshV4Overview());}
  await refresh('historical');assert.equal(await page.locator('#v4-sentiment-state').innerText(),'STALE');
  assert.match(await page.locator('#v4-sentiment-detail').innerText(),/CONTEXT_ONLY/);
  await page.locator('#v4-overview').screenshot({path:path.join(artifacts,'stale-390.png')});
  await refresh('expires');assert.equal(await page.locator('#v4-sentiment-state').innerText(),'CURRENT');
  await page.waitForFunction(()=>document.querySelector('#v4-sentiment-state').textContent==='STALE');
  assert.match(await page.locator('#v4-sentiment-detail').innerText(),/expired/);
  await refresh('blocked');assert.equal(await page.locator('#v4-sentiment-state').innerText(),'UNAVAILABLE');
  await refresh('stale');assert.equal(await page.locator('#v4-paper-state').innerText(),'STALE');
  await refresh('zero');assert.match(await page.locator('#v4-paper-detail').innerText(),/no unmonitored positions/);
  await refresh('missing');assert.match(await page.locator('#v4-paper-detail').innerText(),/unknown/);
  await refresh('unsafe');assert.equal(await page.locator('#v4-overview img').count(),0);assert.equal(await page.evaluate(()=>window.BAD),undefined);
  for(const next of ['error','live']){await refresh(next);assert.equal(await page.locator('#v4-sentiment-state').innerText(),'UNAVAILABLE');assert.match(await page.locator('#v4-overview-status').innerText(),/unavailable/);}
  await page.locator('#v4-overview').screenshot({path:path.join(artifacts,'unavailable-390.png')});
  assert(requests.length>1);assert.deepEqual(errors,[]);
  console.log('V4 overview: desktop/mobile, preserved header/radio/footer, freshness expiry, historical/blocked/missing/error states, no invented statistics, safe text and GET-only checks passed.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
