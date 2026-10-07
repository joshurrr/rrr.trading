const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
 const server = http.createServer((req,res) => {
  let file = path.join(__dirname,new URL(req.url,'http://localhost').pathname); if(file.endsWith(path.sep))file+='index.html';
  fs.readFile(file,(e,data) => {if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));let enabled=true,stale=false,unavailable=false;
  await page.route('https://api.rrr.trading/**',r=>{
   const url=r.request().url();
   if(unavailable || !url.includes('/execution/'))return r.fulfill({status:503,json:{}});
   if(url.includes('/health'))return r.fulfill({json:{mode:'PAPER',status:'available',enabled,stale,run_id:'v2-paper-fixture<script>',started_at:new Date().toISOString(),versions:{learning_version:'learning-v1-baseline',decision_version:'decision-engine-v1',sizing_version:'position-sizing-v1'}}});
   if(url.includes('/records'))return r.fulfill({json:{run_id:'v2-paper-fixture<script>',records:[]}});
   return r.fulfill({json:{available:true,run_id:'v2-paper-fixture<script>',starting_balance:10000,realized_pnl:0,open_pnl:0,win_rate:null,average_trade:null,by_timeframe:{},by_asset:{},total_pnl:0,return_pct:0,wins:0,losses:0,trade_count:0,max_drawdown_pct:0,completed_trades:[]}});
  });
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const folder of ['15minbot','1hrbot','4hrbot']){
   await page.goto(base+'/demo/'+folder+'/');await page.waitForFunction(()=>document.querySelector('#v2-paper')?.textContent.includes('ACTIVE PAPER'));
   assert.equal(await page.locator('#v2-paper script').count(),0);
   const output=await page.evaluate(()=>V2Paper.overlay({bot:{started_at:1},portfolio:{profit_all_abs:999,winning_trades:99},history:[{id:'legacy'}]}));
   assert.equal(output.portfolio.profit_all_abs,0);assert.equal(output.portfolio.winning_trades,0);assert.deepEqual(output.history,[]);assert(output.bot.started_at>1);
   for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});assert(await page.locator('#v2-paper').evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
   for(const width of [375,1440]){await page.setViewportSize({width,height:900});await page.screenshot({path:`.runtime/phase8-${folder}-${width}.png`});}
  }
  enabled=false;await page.reload();await page.waitForFunction(()=>document.querySelector('#v2-paper')?.textContent.includes('PAUSED PAPER'));
  stale=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#v2-paper')?.textContent.includes('unavailable or stale'));
  const unavailableMetrics=await page.evaluate(()=>V2Paper.overlay({bot:{entry_owner:'paper-execution-v1',started_at:1},portfolio:{profit_all_abs:999},history:[{id:'legacy'}]}));
  assert.equal(unavailableMetrics.portfolio.profit_all_abs,null);assert.equal(unavailableMetrics.history,null);
  assert.deepEqual(errors,[]);console.log('PASS v2 epoch stats, safe text, active/paused/stale states and all bot panels at 320/375/768/1440');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
