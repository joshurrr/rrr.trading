const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {chromium}=require('playwright');
const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[],methods=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/radio-navigation.js*',r=>r.fulfill({contentType:'application/javascript',body:''}));
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{methods.push(r.request().method());return r.fulfill({status:503,json:{}});});
 await page.goto(`http://127.0.0.1:${server.address().port}/`);
 await page.waitForSelector('#homepage-trade-history',{state:'attached'});
 await page.waitForLoadState('networkidle');
 await page.evaluate(()=>{document.documentElement.classList.remove('v3-required');document.querySelector('main').hidden=false;window.RRRGeneration={...window.RRRGeneration,acceptsRun:()=>true};});
 const panel=page.locator('#homepage-trade-history'),summary=panel.locator(':scope>summary');
 assert.equal(await page.locator('#order-attempts').count(),0);
 assert.equal(await page.locator('#all-candidate-decisions, #candidate-progress-list').count(),0);
 assert.equal(await panel.evaluate(n=>n.open),false);
 const send=async(mode='normal')=>page.evaluate(mode=>{
  const now=Date.now(),iso=ms=>new Date(ms).toISOString(),start=iso(now-3*86400000),run_id='fixture';
  const trade=(id,closed)=>({id,pair:'BTC/USDT:USDT',direction:'LONG',open_date:iso(now-2*86400000),close_date:iso(closed),open_rate:100,close_rate:101,profit_abs:id===1?-1:2,exit_reason:id===1?'trend_break':'trailing_stop_loss'});
  const metadata={run_id,started_at:start,mode:'PAPER',stale:mode==='stale',last_run:iso(now)};
  const reports=Object.fromEntries(['short','medium','long'].map(k=>[k,{available:true,run_id,started_at:start,observed_at:iso(now),portfolio:{closed_trades:4},open_trades:[],history:[trade(1,now-1000),trade(2,now-2000),trade(3,now-86400000),trade(4,now-86400001)]}]));
  if(mode==='many'){reports.short.history=Array.from({length:60},(_,i)=>trade(i+1,now-1000-i*1000));reports.short.portfolio.closed_trades=60;}
  if(mode==='partial')reports.medium=null;
  if(mode==='empty')for(const r of Object.values(reports)){r.history=[];r.portfolio.closed_trades=0;}
  if(mode==='wrong')reports.short.run_id='wrong';
  if(mode==='malformed')reports.short.history[0].close_date='bad';
  if(mode==='safe')reports.short.history[0].direction='<img src=x onerror="window.BAD=1">';
  if(mode==='reasons')reports.short.history=Array.from({length:13},(_,i)=>({...trade(i+1,now-1000-i*1000),exit_reason:['roi','trend_break','trailing_stop_loss','stop_loss','exit_signal','force_exit','emergency_exit','stoploss_on_exchange','liquidation',null,'','custom_exit','<img src=x onerror="window.BAD=1">'][i]})),reports.short.portfolio.closed_trades=13;
  if(mode==='duplicate')reports.short.history.push(reports.short.history[0]);
  if(mode==='future')reports.short.observed_at=iso(now+60000);
  if(mode==='failed')for(const k of Object.keys(reports))reports[k]=null;
  window.dispatchEvent(new CustomEvent('rrr-order-evidence',{detail:{metadata,reports}}));
 },mode);
 await send();assert.equal(await panel.locator('article').count(),6);assert.equal(await panel.evaluate(n=>n.open),false);
 await summary.focus();await page.keyboard.press('Enter');assert.equal(await panel.evaluate(n=>n.open),true);
 assert.match(await panel.innerText(),/Realized P\/L/i);assert.equal(await panel.locator('[data-tone=down]').count(),3);
 assert.deepEqual(await panel.locator('[data-bot="15m"] .trade-exit-badge').allTextContents(),['Trend Break','Trailing Stop'],'same asset retains its own trade reason');
 assert.equal(await panel.locator('[data-bot="15m"][data-trade-id="1"] .trade-exit-badge').getAttribute('data-mechanism'),'amber','mechanism independent of negative P/L');
 await send('reasons');
 assert.deepEqual(await panel.locator('[data-bot="15m"] .trade-exit-badge').allTextContents(),['Profit Target','Trend Break','Trailing Stop','Stop Loss','Exit Signal','Manual Exit','Emergency Exit','Exchange Stop Loss','Liquidation','Not recorded','Not recorded','custom_exit','<img src=x onerror="window.BAD=1">']);
 assert.equal(await panel.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.BAD),undefined);
 const badge=panel.locator('.trade-exit-badge').first();await badge.focus();assert(await badge.evaluate(n=>n===document.activeElement));assert(await badge.getAttribute('title'));
 await send('duplicate');assert.equal(await panel.locator('article').count(),6);
 await send('many');assert.equal(await panel.locator('article').count(),64,'no artificial 50-record cutoff');
 for(const mode of ['partial','wrong','malformed','future']){await send(mode);assert.match(await panel.innerText(),/Partial coverage/);assert.equal(await panel.locator('article').count(),4);}
 for(const mode of ['stale','failed']){await send(mode);assert.match(await panel.innerText(),/Trade history unavailable/);assert.equal(await panel.locator('article').count(),0);}
 await send('empty');assert.match(await panel.innerText(),/No completed trades in the last 24 hours/);
 await send('safe');assert.equal(await panel.locator('img').count(),0);assert.equal(await page.evaluate(()=>window.BAD),undefined);
 await send();assert.equal(await panel.evaluate(n=>n.open),true,'refresh retains disclosure');
 fs.mkdirSync('.runtime/trade-history',{recursive:true});
 for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:1000});
  const sizes=await panel.evaluate(p=>({panel:p.clientWidth,rows:[...p.querySelectorAll('article')].map(n=>({width:n.getBoundingClientRect().width,scroll:n.scrollWidth,client:n.clientWidth,top:n.getBoundingClientRect().top}))}));
  assert(sizes.rows.every(r=>Math.abs(r.width-sizes.panel)<2&&r.scroll<=r.client+1),'full width, no row overflow '+width);
  assert(sizes.rows.every((r,i)=>!i||r.top>sizes.rows[i-1].top),'one trade per row');
  await panel.screenshot({path:`.runtime/trade-history/expanded-${width}.png`});
  await summary.click();assert.equal(await panel.evaluate(n=>n.open),false);assert((await panel.boundingBox()).height<80);
  await panel.screenshot({path:`.runtime/trade-history/collapsed-${width}.png`});await summary.click();
 }
 await summary.focus();await page.keyboard.press('Space');assert.equal(await panel.evaluate(n=>n.open),false);
 assert.deepEqual(errors,[]);assert(methods.every(m=>m==='GET'));
 console.log('PASS collapsed/keyboard/refresh, all three reports, 24h boundary, no row cutoff, partial/stale/unavailable/empty/invalid/run/future/duplicate/safe-text, full-width rows at 320/375/768/1440, GET-only');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
