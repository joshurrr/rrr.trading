const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
async function run(){
 const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname;const file=path.join(__dirname,name.endsWith('/')?name+'index.html':name);fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  let mode='hold';
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',route=>{
   const endpoint=new URL(route.request().url()).pathname;
   if(endpoint.includes('/reports/'))return route.fulfill({status:503,json:{ok:false}});
   const now=Date.now()/1000,stamp=new Date((now-60)*1000).toISOString();
   if(!endpoint.endsWith('decision-flow'))return route.fulfill({json:{ok:true,demo:'long',generated_at:now,bot:{strategy:'Long Term 4hr',timeframe:'4h',mode:'PAPER',state:'RUNNING',exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,started_at:now-3600,max_open_trades:4,stake_amount:'1000'},portfolio:{open_positions:0},open_trades:[]}});
   if(mode==='outage')return route.fulfill({status:503,json:{ok:false}});
   const scans=['BTC','SOL','ETH'].map((symbol,i)=>({pair:symbol+'/USDT:USDT',state:'SIGNAL',timestamp:stamp,direction:i===1?'SHORT':'LONG',daily_fresh:true,daily_values:{ema20:110,ema50:100,ema200:90,close:115}}));
   const assets=scans.map((s,i)=>{const hold=mode==='hold'?(i===1?5:4):null;return {pair:s.pair,signal_at:mode==='mismatch'?new Date(0).toISOString():stamp,direction:s.direction,hold_stage:hold,reason:hold===4?'BTC rollover protection is holding new longs.':hold===5?'Entry quote moved beyond 0.5 ATR.':'The blocking stage cannot be verified.',stages:Array.from({length:6},(_,j)=>({number:j+1,state:hold===j+1?'HELD':hold&&j+1>hold?'HELD UPSTREAM':j<3?'OBSERVED':'UNVERIFIED',reason:hold===4&&j===3?'BTC protection <img src=x onerror=alert(1)>':hold===5&&j===4?'Entry quote moved beyond 0.5 ATR.':'Current stage outcome.',observed_at:new Date(now*1000).toISOString()}))};});
   const d={ok:true,bot:'long',timeframe:'4h',generated_at:now,market_scan:scans,risk:{open_positions:0,max_open_positions:4},recent_decisions:[],exit_monitoring:[]};
   if(mode!=='missing')d.entry_progress={schema:1,observed_at:new Date((now-(mode==='stale'?90:0))*1000).toISOString(),btc_guard:{state:mode==='hold'?'HELD':'CLEAR',event_at:stamp,observed_at:stamp},assets};
   return route.fulfill({json:d});
  });
  await page.goto('http://127.0.0.1:'+server.address().port+'/demo/4hrbot/');
  await page.waitForFunction(()=>document.querySelector('#entry-hold-summary').textContent.includes('Stage 4'));
  assert.match(await page.locator('#entry-hold-summary').innerText(),/bot is running/);
  assert.equal(await page.locator('.entry-path').count(),3);
  assert.equal(await page.locator('.stage-track li').count(),15);
  assert.equal(await page.locator('[data-stage=intelligence] .held-stage').count(),2);
  assert.equal(await page.locator('[data-stage=risk] .held-stage').count(),1);
  assert.match(await page.locator('[data-stage=risk] [data-pair="SOL/USDT:USDT"]').innerText(),/0.5 ATR/);
  assert.equal(await page.locator('#entry-stage-paths img,[data-stage] img').count(),0);
  assert.equal(await page.locator('.entry-path').first().getByRole('link',{name:/4 · Entry intelligence/}).getAttribute('href'),'#intelligence-title');
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:960});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal overflow at '+width);
   if(width!==320){await page.locator('#entry-hold-summary').screenshot({path:path.join(__dirname,'.runtime','entry-summary-'+width+'.png')});await page.locator('.entry-path').first().screenshot({path:path.join(__dirname,'.runtime','entry-path-'+width+'.png')});}
  }
  mode='clear';await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('.held-stage').count(),0);assert.match(await page.locator('#entry-hold-summary').innerText(),/No confirmed blocking stage/);
  for(mode of ['missing','stale','mismatch','outage']){
   await page.evaluate(()=>loadDecisionFlow());
   assert.match(await page.locator('#entry-hold-summary').innerText(),/Blocking stage unverified/);
   assert.equal(await page.locator('.held-stage').count(),0);
   assert.equal(await page.locator('.entry-path').count(),0);
  }
  assert.deepEqual(errors,[]);console.log('Entry progress: hold attribution, recovery, identity, stale/outage, escaping and responsive layouts PASS');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
run().catch(e=>{console.error(e);process.exitCode=1;});
