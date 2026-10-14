const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'}),page=await browser.newPage({reducedMotion:'reduce'}),errors=[],writes=[];let scenario='healthy';
 const base=process.env.RRR_SLINGSHOT_BASE_URL||`http://127.0.0.1:${server.address().port}`,iso=age=>new Date(Date.now()-age*1000).toISOString();
 page.on('pageerror',e=>errors.push(e.message));await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{const u=new URL(r.request().url());if(r.request().method()!=='GET')writes.push(u.pathname);
  if(u.pathname.includes('/slingshot')&&scenario==='outage')return r.fulfill({status:503,json:{}});
  const open={id:1,pair:'BTC/USDT:USDT',direction:'LONG',open_rate:100,current_rate:103,leverage:2,profit_abs:6,profit_pct:6,open_date:iso(300),stop_loss:101.97};
  const short={...open,id:2,pair:'ETH/USDT:USDT',direction:'SHORT',current_rate:97,stop_loss:97.97};
  if(u.pathname==='/api/demos/slingshot/status')return r.fulfill({json:{ok:true,demo:'slingshot',generated_at:Date.now()/1000-(scenario==='stale'?90:0),bot:{state:'RUNNING',mode:'PAPER',timeframe:'15m'},slingshot:{available:true,observed_at:iso(1),entry_checks:120,last_entry_check_at:iso(1),last_reason:'Conflicting signal <script>window.injected=true</script>',policy:{max_leverage:2,initial_stop:.006},positions:{1:{entry:{confidence:.8,reason:'Aligned <img src=x onerror=alert(1)>',intelligence:{'15m':{direction:'LONG',score:80,reason_summary:'EMA / MACD / RSI'}}},protection:{initial_stop:99.4,stop:101.97,trailing_active:true,trailing_distance:.01}},2:{protection:{initial_stop:100.6,stop:97.97,trailing_active:true,trailing_distance:.01}}}}}});
  if(u.pathname==='/api/slingshot/reporting')return r.fulfill({json:{available:true,bot:'slingshot',mode:'paper',run_id:'slingshot-paper-test',started_at:iso(3600),observed_at:iso(scenario==='stale'?90:1),portfolio:{starting_balance:10000,current_equity:10012,profit_all_abs:12,profit_all_pct:.12,max_drawdown:.001,winning_trades:1,losing_trades:9,win_rate:10,open_positions:scenario==='empty'?0:2,closed_trades:scenario==='empty'?0:1},open_trades:scenario==='empty'?[]:[open,short],history:scenario==='empty'?[]:[{...open,close_rate:104,exit_reason:'slingshot_intelligence_reversal'}]}});
  return r.fulfill({status:503,json:{}});
 });
 try{for(scenario of ['healthy','empty','stale','outage'])for(const width of [320,375,768,1440]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/demo/slingshot/');const content=page.frameLocator('#page-content');
  await content.locator('#slingshot-status').filter({hasText:scenario==='healthy'||scenario==='empty'?'PAPER only':'unavailable'}).waitFor();
  assert.equal(await page.locator('.mode-button[aria-current]').innerText(),'TRADING BOTS');assert.equal(await page.locator('.mode-button[href="/demo/slingshot/"]').count(),0);assert.equal(await page.locator('#bots-shortcuts a[href="/demo/slingshot/"]').count(),1);
  assert(await content.locator('body').evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No overflow '+width);
  if(scenario==='healthy'){assert.match(await content.locator('#slingshot-metrics').innerText(),/10012.00 USDT/);assert.match(await content.locator('#slingshot-open').innerText(),/LONG/);assert.match(await content.locator('#slingshot-open').innerText(),/SHORT/);assert.match(await content.locator('#slingshot-open').innerText(),/2×/);assert.equal(await content.locator('#slingshot-open script,#slingshot-open img').count(),0);
   await content.locator('[data-intelligence-symbol="BTC"]').first().click();await content.locator('#asset-intelligence-dialog[open]').waitFor();await page.keyboard.press('Escape');
   if([375,1440].includes(width)){fs.mkdirSync('.runtime/slingshot',{recursive:true});await page.screenshot({path:`.runtime/slingshot/${width}.png`,fullPage:true});}
  }else if(scenario==='empty')assert.match(await content.locator('#slingshot-open').innerText(),/No open positions/);
  else assert.match(await content.locator('#slingshot-open').innerText(),/unavailable or stale/);
 }
 await page.goto(base+'/bots/');await page.frameLocator('#page-content').locator('[data-bot="slingshot"]').waitFor();assert.equal(await page.frameLocator('#page-content').locator('.bot-overview-card').count(),4);
 assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS Slingshot dashboard: four widths, long/short, safe text, modal, empty/stale/outage, fourth bot and GET-only');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
