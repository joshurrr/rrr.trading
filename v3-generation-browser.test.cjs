'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{
  let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/radio-navigation.js*',r=>r.fulfill({contentType:'application/javascript',body:''}));
  const start=new Date(Date.now()-60000).toISOString(),factory=new Date(Date.now()-120000).toISOString(),run_id='v3-paper-browser';
  let generation={generation:3,application:'RRR.Trading V3',factory_reset_at:factory,phase:'ACTIVE',entries_blocked:false,run_id};
  await page.route('https://api.rrr.trading/**',r=>{
   const p=new URL(r.request().url()).pathname;
   if(p==='/api/system/generation')return r.fulfill(generation?{json:generation}:{status:503,json:{}});
   if(p.endsWith('/execution/health'))return r.fulfill({json:{run_id,started_at:start,mode:'PAPER',stale:false,status:'available',enabled:true,last_run:new Date().toISOString()}});
   if(p.endsWith('/reporting'))return r.fulfill({json:{available:true,run_id,started_at:start,observed_at:new Date().toISOString(),portfolio:{closed_trades:0,profit_closed_abs:0,winning_trades:0,losing_trades:0,win_rate:null,profit_open_abs:0,max_drawdown:0},history:[],open_trades:[]}});
   if(p.endsWith('/status'))return r.fulfill({json:{ok:true,generated_at:Date.now()/1000,bot:{mode:'PAPER',state:'RUNNING',stake_currency:'USDT',timeframe:p.includes('/short/')?'15m':p.includes('/long/')?'4h':'1h',pairs:[]},open_trades:[],history:[],portfolio:{closed_trades:99}}});
   return r.fulfill({status:503,json:{}});
  });
  for(const route of ['/', '/demo/15minbot/','/demo/1hrbot/','/demo/4hrbot/']){
   for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}${route}`);
    await page.waitForFunction(()=>document.documentElement.classList.contains('v3-ready'));
    assert(await page.locator('#main').isVisible());
    assert((await page.locator('#v3-generation').innerText()).includes('current run only'));
    assert(await page.locator('#v3-generation').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    assert.equal(await page.evaluate(()=>window.RRRGeneration.acceptsRun({run_id:'v2-paper-old',started_at:new Date().toISOString()})),false);
    await page.locator('#v3-generation').screenshot({path:`.runtime/v3-${route==='/'?'home':route.split('/')[2]}-${width}.png`});
   }
   generation={...generation,phase:'REBUILDING',entries_blocked:true,run_id:null};
   await page.reload();await page.waitForFunction(()=>document.querySelector('#v3-generation')?.textContent.includes('Collecting fresh'));
   assert(!(await page.locator('#main').isVisible()));
   generation={...generation,phase:'FAILED'};await page.reload();await page.waitForFunction(()=>document.querySelector('#v3-generation')?.textContent.includes('needs attention'));
   assert(!(await page.locator('#main').isVisible()));
   generation=null;await page.reload();await page.waitForFunction(()=>document.querySelector('#v3-generation')?.textContent.includes('not been verified'));
   assert(!(await page.locator('#main').isVisible()));
   generation={generation:3,application:'RRR.Trading V3',factory_reset_at:factory,phase:'ACTIVE',entries_blocked:false,run_id};
  }
  assert.deepEqual(errors,[]);console.log('PASS all four V3 pages at four widths, active identity, legacy rejection, rebuild/failure/outage withholding');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1});
