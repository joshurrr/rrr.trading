const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.join(__dirname,new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let state='fresh',bias=-25,stamp=Date.now()-120000;
  await page.route('**/radio-navigation.js*',r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{
   const endpoint=new URL(r.request().url()).pathname;
   if(state==='failed')return r.fulfill({status:503});
   if(endpoint==='/api/trading-context')return r.fulfill({json:{ok:true,mode:'observation_only',fresh:true,generated_at:new Date(Date.now()-(state==='stale'?720000:0)).toISOString(),universe:['BTC','ETH'],crypto:{available:true,fresh:true,bias_score:bias,coverage:1,calculated_at:new Date().toISOString(),updated_at:new Date(stamp).toISOString(),valid_until:new Date(Date.now()+600000).toISOString(),components:{breadth:-50,market_momentum:20}},macro:{available:true,fresh:true,bias_score:0,coverage:.9,source:'daily_macro_report',report_date:new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(Date.now()-(Number(new Intl.DateTimeFormat('en-AU',{timeZone:'Australia/Brisbane',hour:'2-digit',hourCycle:'h23'}).format())<7?86400000:0)),generated_at:new Date(Date.now()-3600000).toISOString()}}});
   if(endpoint==='/api/schedule/economic')return r.fulfill({json:{schema_version:1,status:'partial',generated_at:new Date().toISOString(),expires_at:new Date(Date.now()+86400000).toISOString(),events:[]}});
   return r.fulfill({status:503});
  });
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.waitForFunction(()=>document.querySelector('#vibe-mood').textContent==='NERVOUS');
  assert.match(await page.locator('#vibe-direction').innerText(),/UNKNOWN/);
  assert(await page.locator('#market-vibe').evaluate(el=>el.previousElementSibling.hasAttribute('data-site-header') && el.nextElementSibling.id==='main'));
  fs.mkdirSync(path.join(__dirname,'.runtime'),{recursive:true});
  for(const width of [1440,375]){
   await page.setViewportSize({width,height:1000});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Viewport overflow');
   await page.locator('#market-vibe').screenshot({path:path.join(__dirname,'.runtime','market-vibe-'+width+'.png')});
  }
  bias=-10;stamp+=60000;await page.evaluate(()=>refreshMarketVibe());
  assert.equal(await page.locator('#vibe-direction').innerText(),'IMPROVING ↗');
  await page.evaluate(()=>refreshMarketVibe());
  // Macro fixture gets a newer source timestamp on refresh; same crypto score is stable.
  assert.match(await page.locator('#vibe-direction').innerText(),/STABLE|IMPROVING/);
  state='stale';await page.evaluate(()=>refreshMarketVibe());
  assert.equal(await page.locator('#vibe-mood').innerText(),'MARKET VIBE UNKNOWN');
  assert.match(await page.locator('#vibe-coverage').innerText(),/stale/);
  await page.locator('#market-vibe').screenshot({path:path.join(__dirname,'.runtime','market-vibe-stale.png')});
  state='failed';await page.evaluate(()=>refreshMarketVibe());
  assert.match(await page.locator('#vibe-coverage').innerText(),/unavailable/);
  assert.match(await page.locator('#vibe-direction').innerText(),/UNKNOWN/);
  state='fresh';await page.evaluate(()=>refreshMarketVibe());
  assert.equal(await page.locator('#vibe-mood').innerText(),'CAUTIOUS');
  await page.locator('#market-vibe a').focus();assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),'/market-conditions/');
  assert.deepEqual(errors,[]);
  console.log('Desktop/mobile banner, direction, stale, failed, recovery and keyboard link checks passed.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
