const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
async function run(){
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://localhost').pathname);if(req.url.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(d);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 let pairs=['BTC','XRP'],statusFail=false,flowFail=false,stale=false,rich=false,active=false;
 const now=()=>Date.now()/1000,at=()=>new Date(Date.now()-60000).toISOString();
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{
  const p=new URL(r.request().url()).pathname;
  if(p==='/api/demos/short/status')return statusFail?r.fulfill({status:503}):r.fulfill({json:{ok:true,demo:'short',generated_at:now()-(stale?90:0),bot:{timeframe:'15m',mode:'PAPER',strategy:'Short Term 15m',exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,pairs:pairs.map(p=>p+'/USDT:USDT')},portfolio:{},history:[],open_trades:pairs.map((p,i)=>({id:i+1,pair:p+'/USDT:USDT',direction:i?'SHORT':'LONG',open_rate:i?1.5166:86218.6,current_rate:i?1.5157:86021.4,profit_abs:i?.793:-2.35,profit_pct:i?.08:-.25,open_date:'2026-10-05 01:00:00'}))}});
  if(p==='/api/demos/short/decision-flow')return flowFail?r.fulfill({status:503}):r.fulfill({json:{ok:true,bot:'short',timeframe:'15m',generated_at:now(),market_scan:[],final_decision:{state:'NO SIGNAL'},exit_monitoring:['BTC','XRP','ETH'].map((p,i)=>({trade_id:i+1,pair:p+'/USDT:USDT',timestamp:at(),exit_signal:'INACTIVE',trend:'UNKNOWN',momentum:'UNKNOWN',trailing_stop:'UNKNOWN',profit_target:'UNKNOWN',...(rich?{status:active?'EXIT CONDITION ACTIVE':'MONITORING INCOMPLETE',checks:[{label:'Trend intact',state:'YES',explanation:'Candle branch not triggered.'},{label:'Stoploss',state:active?'REACHED':'NOT REACHED',explanation:'Active bot stop 81245 USDT.'},{label:'Trailing stop',state:'DATA UNAVAILABLE',explanation:'Activation flag not published.'},{label:'BTC rollover custom exit',state:'DATA UNAVAILABLE',explanation:'Current callback vote not published.'}],summary:'Some exit checks are unavailable.'}:{})}))}});
  return r.fulfill({status:404,json:{}});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/demo/15minbot/');
 await page.waitForFunction(()=>document.querySelectorAll('.exit-card').length===2);
 assert.equal(await page.locator('#exit-title').innerText(),'7 · Exit Monitoring');
 assert(!/UNKNOWN/.test(await page.locator('#exit-panel').innerText()));
 assert.equal(await page.locator('.exit-card').count(),2);assert(!/ETH/.test(await page.locator('#exit-panel').innerText()),'Closed/non-status positions omitted');
 assert.match(await page.locator('.exit-card').first().innerText(),/LONG.*Entry price.*86,218.6.*Current price.*86,021.4.*-2.35 USDT \/ -0.25%/s);
 assert.match(await page.locator('.exit-card').nth(1).innerText(),/SHORT.*\+0.79 USDT \/ \+0.08%/s);
 rich=true;await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('#exit-panel').innerText(),/Active bot stop 81245/);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width);
  const boxes=await page.locator('.exit-card').evaluateAll(ns=>ns.map(n=>({x:n.getBoundingClientRect().x,y:n.getBoundingClientRect().y})));
  assert(width>700?boxes[0].y===boxes[1].y:boxes[0].x===boxes[1].x);
  if(width===390||width===1440)await page.locator('#exit-panel').screenshot({path:path.join(os.tmpdir(),'rrr-exit-'+width+'.png')});
 }
 active=true;await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('#exit-panel').innerText(),/EXIT CONDITION ACTIVE/);assert(!/ORDER SENT/.test(await page.locator('#exit-panel').innerText()));
 pairs=['XRP'];await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('.exit-card').count(),1);assert(!/BTC\/USDT/.test(await page.locator('#exit-panel').innerText()));
 pairs=[];await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('#exit-panel').innerText(),/No open positions currently being monitored/);
 pairs=['SOL'];await page.evaluate(()=>loadDecisionFlow());assert.match(await page.locator('#exit-panel').innerText(),/SOL\/USDT/);
 flowFail=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('.exit-card').count(),1);assert.match(await page.locator('#exit-panel').innerText(),/MONITORING INCOMPLETE/);
 statusFail=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('.exit-card').count(),0);assert.match(await page.locator('#exit-panel').innerText(),/current open positions cannot be verified/);
 statusFail=false;flowFail=false;stale=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('.exit-card').count(),0);assert.match(await page.locator('#exit-status').innerText(),/STALE/);
 stale=false;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('.exit-card').count(),1);assert.equal(await page.locator('#final .big').textContent(),'NO SIGNAL');
 assert.deepEqual(errors,[]);console.log('PASS Exit Monitoring: live membership, long/short, P/L, 0/1/2 positions, close removal, incomplete/active states, outages, stale/recovery, responsive layouts.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
module.exports=run;if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
