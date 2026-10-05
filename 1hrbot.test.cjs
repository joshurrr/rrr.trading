const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
async function run(){
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');let file=path.join(__dirname,url.pathname);if(url.pathname.endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(d);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));let stale=false,failed=false,wrong=false,flowAvailable=false,noPaths=false,flowStale=false;
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 await page.route('https://api.rrr.trading/**',r=>{
  const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);
  if(endpoint==='/score')return r.fulfill({json:{assets:[]}});
  if(endpoint==='/api/market-summary')return r.fulfill({json:{currency:'USD',markets:[]}});
  if(endpoint==='/api/demos/medium/decision-flow'){
   if(!flowAvailable)return r.fulfill({status:404,json:{detail:'Not found'}});
   const timestamp=new Date(Math.floor(Date.now()/3600000)*3600000).toISOString();
   return r.fulfill({json:{ok:true,bot:'medium',timeframe:'1h',generated_at:Date.now()/1000-(flowStale?90:0),
    market_scan:noPaths?[]:[{pair:'LINK/USDT:USDT',timestamp,state:'OPEN',direction:null,indicators:{rsi:41},daily_fresh:false},{pair:'AAVE/USDT:USDT',timestamp,state:'OPEN',direction:'SHORT',indicators:{rsi:35},daily_fresh:true,daily_values:{ema20:90,ema50:100,ema200:110,close:85}},{pair:'ETH/USDT:USDT',timestamp,state:'SIGNAL',direction:'LONG',indicators:{ema20:110,ema50:100,ema200:90,rsi:60,macd:2,macdsignal:1,volume:20},daily_fresh:true,daily_values:{ema20:110,ema50:100,ema200:90,close:115}},...['BTC','SOL','XRP','ONDO','UNI','HYPE','INJ'].map(symbol=>({pair:symbol+'/USDT:USDT',timestamp,state:'NO SIGNAL'}))],
    technical:{pair:'ETH/USDT:USDT',timestamp,state:'SIGNAL',values:{ema20:110,ema50:100,ema200:90,rsi:60,macd:2,macdsignal:1,volume:20}},
    higher_timeframe_trend:{fresh:true,values:{ema20:110,ema50:100,ema200:90,close:115}},
    traderouter:{state:'FAIL-OPEN',macro:{available:true,fresh:true,source_score_0_100:50,coverage:1,confidence:70},research_flags:'UNKNOWN'},
    risk:{state:'UNKNOWN'},final_decision:{state:'UNKNOWN'},recent_decisions:[],exit_monitoring:[]}});
  }
  if(endpoint!=='/status'||failed)return r.fulfill({status:503});
  const trade={pair:'ETH/USDT:USDT',direction:'SHORT',open_rate:100,current_rate:101,close_rate:98,stake_amount:1000,profit_abs:20,profit_pct:2,open_date:'2026-10-04 02:00:00',close_date:'2026-10-04 03:00:00',exit_reason:'roi',entry_tag:'private-strategy-debug'};
  return r.fulfill({json:{ok:true,generated_at:Date.now()/1000-(stale?90:0),bot:{timeframe:wrong?'4h':'1h',strategy:wrong?'Long Term 4hr':'Medium 1hr',mode:'PAPER',state:'RUNNING',exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,stake_amount:'1000',max_open_trades:4,started_at:Date.now()/1000-3600,pairs:['ETH/USDT:USDT']},portfolio:{starting_balance:10000,profit_all_abs:20,profit_all_pct:.2,max_drawdown:0,winning_trades:6,losing_trades:19,closed_trades:2},open_trades:[trade],history:[trade]}});
 });
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/demo/?source=bookmark#settings');
 assert.equal(new URL(page.url()).pathname,'/demo/1hrbot/');assert.equal(new URL(page.url()).search,'?source=bookmark');assert.equal(new URL(page.url()).hash,'#settings');
 await page.waitForFunction(()=>document.querySelector('#trades-status').textContent==='1 open positions'&&document.querySelector('#flow-status').textContent.includes('UNAVAILABLE'));
 assert.equal(await page.title(),'RRR.Trading · 1HRBOT');assert.equal(await page.locator('.header-hero-title').innerText(),'1 hour bot - currently trading');
 assert.equal(await page.locator('.operating-modes [aria-current]').getAttribute('href'),'/demo/1hrbot/');
 assert.match(await page.locator('#strategy-flow-title').innerText(),/hourly trends/);assert.match(await page.locator('#daily .node-title').innerText(),/4-hour Short Confirmation/);
 assert.match(await page.locator('#flow').innerText(),/short trades also need a confirmed 4-hour downtrend/);
 assert.equal(await page.locator('#final .big').textContent(),'UNKNOWN');
 assert.equal(await page.locator('#performance,#winRate,#profit,#profitPct,#drawdown,#completed').count(),0,'Hourly page intentionally omits the performance summary');
 assert.equal(await page.locator('#exchange').innerText(),'Bybit');assert.equal(await page.locator('#starting').innerText(),'10,000 USDT');assert.equal(await page.locator('#maxOpen').innerText(),'4');assert.equal(await page.locator('#maxTrade').innerText(),'1,000 USDT');
 assert.equal(await page.locator('#open-trades tr').count(),1,'Open trades render without the optional performance panel');assert.match(await page.locator('#open-trades').innerText(),/ETH\/USDT/);assert.equal(await page.locator('#metrics-status').innerText(),'Settings · public 1hr bot feed');
 const stageIds=['scan','technical','daily','intelligence','risk','final'];
 const configuredGuides=await Promise.all(stageIds.map(id=>page.locator('#'+id+' .stage-guide').innerText()));
 assert(configuredGuides.every(text=>text.trim().length>0),'Every stage explains its configured rules beside its readings');
 assert.match(configuredGuides[2],/75 minutes/);assert.match(configuredGuides[2],/0.5 ATR/);
 assert.match(configuredGuides[3],/required data blocks new entries/);
 assert.match(configuredGuides[3],/individual votes/);assert.match(configuredGuides[4],/per-bot asset admission/);
 assert(!/Missing, stale or insufficient macro data lets|economic event calendar is not connected/i.test(await page.locator('main').innerText()));
 flowAvailable=true;await page.evaluate(()=>loadDecisionFlow());
 assert.equal(await page.locator('#technical .node-main').textContent(),'SIGNAL');
 assert.match(await page.locator('#daily .contents').textContent(),/Trend conflict\s*NOT REQUIRED/,'Hourly longs do not require higher-timeframe confirmation');
 assert.match(await page.locator('#intelligence .contents').textContent(),/hourly guard uses partial saved primary calendars/);
 assert.equal(await page.locator('#final .big').textContent(),'UNKNOWN','Legacy gate failure is not proof of an order');
 assert.equal(await page.locator('.scan-tile').count(),10);assert.equal(await page.locator('.scan-tile.scan-open').count(),2);assert.equal(await page.locator('.scan-tile.scan-signal').count(),1);assert.equal(await page.locator('.scan-tile.scan-none').count(),7);
 assert.equal(await page.locator('#technical > .node-main').isVisible(),false,'Single selected-asset observation is hidden');
 for(const id of ['technical','daily','intelligence','risk','final'])assert.equal(await page.locator('[data-stage='+id+'] .asset-path').count(),3);
 assert.match(await page.locator('[data-stage=technical] [data-pair="AAVE/USDT:USDT"]').innerText(),/RSI\s+35/);
 assert.match(await page.locator('[data-stage=daily] [data-pair="AAVE/USDT:USDT"]').innerText(),/DOWNTREND/);
 assert.match(await page.locator('[data-stage=daily] [data-pair="LINK/USDT:USDT"]').innerText(),/STALE/);
 assert.match(await page.locator('[data-stage=intelligence] [data-pair="AAVE/USDT:USDT"]').innerText(),/TradeRouter decision\s+Not confirmed/);
 assert.match(await page.locator('[data-stage=final] [data-pair="ETH/USDT:USDT"]').innerText(),/Order sent\s+UNKNOWN/);
 for(let i=0;i<stageIds.length;i++)assert.equal(await page.locator('#'+stageIds[i]+' .stage-guide').innerText(),configuredGuides[i],'Feed refresh preserves stage guide '+stageIds[i]);
 for(const detail of await page.locator('#flow details,#exit-panel details').all())await detail.evaluate(el=>el.open=true);
 assert.match(await page.locator('#technical .stage-guide').innerText(),/52 < RSI < 70/);
 assert.match(await page.locator('#intelligence .stage-guide').innerText(),/60 minutes before to 30 minutes after/);
 assert.match(await page.locator('#exit-panel .exit-guide').innerText(),/positions opened before the guard/i);
 assert.match(await page.locator('#exit-panel .exit-guide').innerText(),/6% initially, 3.5% after 6 hours/);

 assert.match(await page.locator('#completed-trades').innerText(),/Profit target/);assert.equal(await page.locator('#asset-cards,#asset-analysis').count(),0);assert(!/private-strategy-debug/.test(await page.locator('main').innerText()));
 for(let i=0;i<stageIds.length;i++)configuredGuides[i]=await page.locator('#'+stageIds[i]+' .stage-guide').innerText();
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow '+width);await page.screenshot({path:path.join(os.tmpdir(),'rrr-1hrbot-'+width+'.png'),fullPage:true});if(width===390||width===1440){await page.locator('#scan').screenshot({path:path.join(os.tmpdir(),'rrr-hourly-scan-'+width+'.png')});await page.locator('#intelligence').screenshot({path:path.join(os.tmpdir(),'rrr-1hrbot-guard-'+width+'.png')});}}
 noPaths=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('.asset-path').count(),0);assert.match(await page.locator('[data-stage=technical]').innerText(),/No new signals/);noPaths=false;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('[data-stage=technical] .asset-path').count(),3);
 flowStale=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('[data-stage=technical] .node-main').first().innerText(),'STALE');assert.equal(await page.locator('.scan-tile.scan-unavailable').count(),10);assert.equal(await page.locator('.scan-state').first().innerText(),'STALE');flowStale=false;await page.evaluate(()=>loadDecisionFlow());
 flowAvailable=false;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('[data-stage=final] .node-main').first().innerText(),'UNAVAILABLE');flowAvailable=true;await page.evaluate(()=>loadDecisionFlow());
 stale=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#trades-status').innerText(),'STALE · previous trades retained; not current');assert.equal(await page.locator('#open-trades tr').count(),1);assert.equal(await page.locator('#settings.stale').count(),1);for(let i=0;i<stageIds.length;i++)assert.equal(await page.locator('#'+stageIds[i]+' .stage-guide').innerText(),configuredGuides[i],'Stale data preserves guide '+stageIds[i]);assert.equal(await page.locator('#completed-trades tr').count(),0);
 stale=false;wrong=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#trades-status').innerText(),'UNAVAILABLE · previous trades retained; not current');
 wrong=false;failed=true;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#trades-status').innerText(),'UNAVAILABLE · previous trades retained; not current');
 failed=false;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#trades-status').innerText(),'1 open positions');assert.equal(await page.locator('#settings.stale').count(),0);assert.equal(await page.locator('#completed-trades tr').count(),1);
 failed=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#settings').classList.contains('stale'));assert.equal(await page.locator('#trades-status').innerText(),'UNAVAILABLE');assert.equal(await page.locator('#exchange').innerText(),'—');assert.equal(await page.locator('#open-trades tr').count(),0);
 failed=false;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#trades-status').innerText(),'1 open positions');assert.equal(await page.locator('#exchange').innerText(),'Bybit');
 assert(calls.includes('/status'));assert(!calls.some(p=>p.includes('/long/')||p.includes('/short/')),'Hourly page must not load another bot feed');assert.deepEqual(errors,[]);
 console.log('PASS 1HRBOT: migration redirect, hourly-only status feed, settings and open trades without optional performance, unavailable diagnostics, six adjacent stage guides, exact entry/exit rules, persisted guides through diagnostic refresh/stale states, history/assets, stale/outage/wrong-feed/recovery and four responsive widths.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
module.exports=run;if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
