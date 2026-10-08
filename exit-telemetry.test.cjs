const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file=path.join(__dirname,url.pathname);if(url.pathname.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(d);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  fs.mkdirSync(path.join(__dirname,'.runtime/exit-telemetry'),{recursive:true});
  for(const [bot,pageName,frame,label] of [['short','15minbot','15m','Short Term 15m'],['medium','1hrbot','1h','Medium 1hr'],['long','4hrbot','4h','Long Term 4hr']]){
   const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   let side='LONG',active=false,missing=false,stale=false,fail=false,expire=false,present=true;
   const stamp=offset=>new Date(Date.now()+offset).toISOString();
   const telemetry=()=>({schema:1,timeframe:frame,side,fresh:!stale,state:stale?'STALE':missing?'MONITORING INCOMPLETE':active?'EXIT SIGNAL ACTIVE':'MONITORING',observed_at:stamp(-1000),candle_observed_at:stamp(-60000),valid_until:stamp(expire?1500:25000),
    trend:{available:!missing,state:'ALIGNED',close:5.373,ema50:5.18},momentum:{available:!missing,state:'ALIGNED',rsi:60,macd:.0692,macd_signal:.0585},
    stop_loss:{available:!missing,active:missing?null:true,price:missing?null:5.14,initial_price:5.14,distance_ratio:-.06},
    trailing_stop:{available:true,enabled:true,state:'ENABLED',positive:.02,positive_offset:.035},roi:{available:true,state:'CONFIGURED',current_required_roi:.035},
    strategy_exit:{available:!missing,active:missing?null:active,applicable_signal:side==='LONG'?'exit_long':'exit_short',exit_long:side==='LONG'?active:!active,exit_short:side==='SHORT'?active:!active,exit_tag:active?'<img src=x onerror=alert(1)>':null},note:'Native telemetry; execution is separate.'});
   await page.route('https://stream.radiorrr.com/**',r=>r.abort());
   await page.route('https://api.rrr.trading/**',r=>{
    const p=new URL(r.request().url()).pathname;
    if(p===(bot==='medium'?'/status':'/api/demos/'+bot+'/status'))return r.fulfill({json:{ok:true,demo:bot,generated_at:Date.now()/1000,bot:{timeframe:frame,mode:'PAPER',strategy:label,exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,pairs:['NEAR/USDT:USDT']},portfolio:{},history:[],open_trades:present?[{id:7,pair:'NEAR/USDT:USDT',direction:side,open_rate:5.4,current_rate:5.373,profit_abs:0,profit_pct:0,open_date:stamp(-3600000)}]:[]}});
    if(p==='/api/demos/'+bot+'/decision-flow')return fail?r.fulfill({status:503,json:{}}):r.fulfill({json:{ok:true,bot,timeframe:frame,generated_at:Date.now()/1000,market_scan:[],final_decision:{state:'NO SIGNAL'},exit_monitoring:[{trade_id:7,pair:'NEAR/USDT:USDT',telemetry:telemetry()}]}});
    return r.fulfill({status:404,json:{}});
   });
   await page.goto('http://127.0.0.1:'+server.address().port+'/demo/'+pageName+'/');
   await page.waitForFunction(()=>document.querySelector('.exit-card')?.innerText.includes('MONITORING'));
   let text=await page.locator('.exit-card').innerText();assert.match(text,/INACTIVE/);assert.match(text,/exit_long = NO/);assert(!text.includes('EXIT SIGNAL ACTIVE'));assert.match(text,/5.14 USDT/);assert.match(text,/RSI 60/);assert.match(text,/0.0692 \/ 0.0585/);assert.match(text,/-6.00% from current bot price/);assert(!text.includes('UNKNOWN'));
   for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:1000});
    const box=await page.locator('.exit-card').boundingBox();assert(box.x>=0&&box.x+box.width<=width+1,bot+' card width '+width);
    assert(await page.locator('.exit-card').evaluate(n=>n.scrollWidth<=n.clientWidth+1),bot+' card contents '+width);
    if(width===375||width===1440)await page.locator('#exit-panel').screenshot({path:path.join(__dirname,'.runtime/exit-telemetry',bot+'-'+width+'.png')});
   }
   active=true;await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('.exit-card').innerText(),/EXIT SIGNAL ACTIVE/);assert.equal(await page.locator('.exit-card img').count(),0);
   side='SHORT';await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('.exit-card').innerText(),/exit_short = YES/);
   active=false;await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('.exit-card').innerText(),/exit_short = NO/);
   stale=true;await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('.exit-card').innerText(),/STALE/);assert(!/Strategy exit\s+INACTIVE/.test(await page.locator('.exit-card').innerText()));
   stale=false;missing=true;await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('.exit-card').innerText(),/MONITORING INCOMPLETE/);assert.match(await page.locator('.exit-card').innerText(),/DATA UNAVAILABLE/);
   missing=false;fail=true;await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('.exit-card').innerText(),/MONITORING INCOMPLETE/);
   fail=false;expire=true;await page.evaluate(()=>loadDecisionFlow());await page.waitForFunction(()=>document.querySelector('.exit-card')?.innerText.includes('STALE'));
   expire=false;await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('.exit-card').innerText(),/MONITORING/);
   present=false;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('.exit-card').count(),0);
   assert.deepEqual(errors,[]);await page.close();console.log('PASS '+bot+' native telemetry, side, stops, indicators, stale, missing, expiry, safe text and four widths');
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
