const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const root=path.resolve(__dirname,'..'),server=http.createServer((req,res)=>{const pathname=decodeURIComponent(req.url.split('?')[0]);if(pathname==='/demo-fixture.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><head><meta charset=utf-8><link rel=stylesheet href=/demo/bybit-demo.css></head><body data-bot=short><section id=bybit-demo-public></section><script src=/demo/bybit-demo.js></script>');}const file=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));if(!file.startsWith(root+path.sep))return res.writeHead(404).end();try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file));}catch(_){res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));
  const make=()=>({version:'bybit-demo-public-v1',mode:'DEMO',bot:'short',observed_at:new Date().toISOString(),connection:'VERIFIED',budget_usdt:1000,execution_enabled:false,real_orders_possible:false,fresh:true,state:'CONNECTED_DISABLED',max_age_seconds:90,performance:{state:'NOT_STARTED',net_pnl_usdt:null,return_pct:null,trade_count:null},positions:{state:'NOT_STARTED',items:[]},fills:{state:'NOT_STARTED',items:[]}});
  let data=make(),failure=false;
  await page.route('https://api.rrr.trading/**',async route=>{
   if(!route.request().url().endsWith('/api/demos/short/bybit-demo'))return route.fulfill({status:503,json:{}});
   const req=route.request();calls.push({method:req.method(),headers:await req.allHeaders()});const result=data;
   try{await route.fulfill(failure?{status:503,json:{}}:{json:result});}catch(_){}
  });
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/demo/15minbot/');
  let panel=page.frameLocator('#page-content').locator('#bybit-demo-public');await panel.getByRole('status').filter({hasText:'verified'}).waitFor();
  let content=page.frames().find(frame=>frame.url().includes('/demo/15minbot/'));
  assert(await panel.isVisible());assert.match(await panel.innerText(),/SIMULATED FUNDS/);assert.match(await panel.innerText(),/1,000 USDT/);assert.match(await panel.innerText(),/Not started/);assert.equal(await panel.locator('button,input,form').count(),0);
  assert(!(await panel.innerText()).includes('50,000'));assert(!(await panel.innerText()).includes('0.00%'));
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});assert(await panel.isVisible());assert(await content.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);if([375,1440].includes(width)){fs.mkdirSync(path.join(root,'.runtime'),{recursive:true});await panel.screenshot({path:path.join(root,'.runtime','bybit-demo-public-'+width+'.png')});}}
  const refresh=async()=>{await page.goto('http://127.0.0.1:'+server.address().port+'/demo-fixture.html');panel=page.locator('#bybit-demo-public');content=page;};
  data={...make(),observed_at:new Date(Date.now()-91000).toISOString()};await refresh();await panel.getByRole('status').filter({hasText:'stale'}).waitFor();assert.match(await panel.innerText(),/1,000 USDT · saved/);assert(!/connection verified/.test(await panel.innerText()));
  for(const mutation of [{mode:'LIVE'},{execution_enabled:true},{budget_usdt:'<img src=x onerror=alert(1)>'},{state:'RUNNING'},{version:'future-v2'},{observed_at:new Date(Date.now()+60000).toISOString()},{performance:{state:'FRESH',net_pnl_usdt:500,return_pct:50,trade_count:10}}]){data={...make(),...mutation};await refresh();await panel.getByRole('status').filter({hasText:'unavailable'}).waitFor();assert.equal(await panel.locator('img').count(),0);}
  failure=true;await refresh();await panel.getByRole('status').filter({hasText:'unavailable'}).waitFor();failure=false;
  data={...make(),connection:'NOT_CONFIGURED',state:'NOT_CONFIGURED',budget_usdt:null};await refresh();await panel.getByRole('status').filter({hasText:'not connected'}).waitFor();
  assert(calls.every(c=>c.method==='GET'&&!c.headers.authorization));assert.deepEqual(errors,[]);
  console.log('PASS public Demo panel: independent of paper availability, 4 widths, simulated labels, unavailable/stale/future/invalid states, no invented results, safe text, GET-only and independent evidence rendering.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
