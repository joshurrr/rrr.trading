const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
async function run(keys=['short','medium','long']){
 const root=__dirname;
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');let file=path.join(root,decodeURIComponent(url.pathname));
  if(url.pathname.endsWith('/'))file=path.join(file,'index.html');
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let failed=false,stale=false,sign=0,missingPairs=false,missingPerformance=false,researchFailed=false,marketStale=false,drawdown=0.024,limit=4,closed=25,wins=6,losses=19,stakeAmount="1000",startingBalance=1000,startOffset=54*3600000,sessionStart=null,exchange="bybit",tradeStake=997.079;const calls=[];
  const pairs={short:['BTC/USDT:USDT','ETH/USDT:USDT'],medium:['SOL/USD','XRP/USD'],long:['LINK/USDT:USDT']};
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{
   const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);
   if(endpoint==='/score')return r.fulfill({status:researchFailed?503:200,json:{assets:[{pair:'BTC/USDT:USDT',trend_score:67,confidence:80,raw_veto:'private-debug'}]}});
   if(endpoint==='/api/market-summary')return r.fulfill({status:researchFailed?503:200,json:{currency:'USD',markets:['BTC','ETH','SOL','XRP','LINK'].map(symbol=>({symbol,price:100,change_24h:1,updated_at:new Date(Date.now()-(marketStale?180000:0)).toISOString()}))}});
   if(failed)return r.fulfill({status:503,json:{ok:false}});
   const key=endpoint.includes('/short/')?'short':endpoint.includes('/long/')?'long':'medium';
   const trade={pair:pairs[key][0],direction:sign>0?'SHORT':'LONG',open_rate:100,current_rate:110,close_rate:111,stake_amount:tradeStake,profit_abs:missingPerformance?null:sign*10,profit_pct:missingPerformance?null:sign,entry_tag:'secret-debug-version',exit_reason:'roi',open_date:new Date().toISOString(),close_date:new Date().toISOString()};
   return r.fulfill({json:{ok:true,demo:key,generated_at:Date.now()/1000-(stale?90:0),bot:{pairs:missingPairs?null:pairs[key],strategy:{short:'Short Term 15m',medium:'Medium 1hr',long:'Long Term 4hr'}[key],state:'RUNNING',mode:'PAPER',timeframe:{short:'15m',medium:'1h',long:'4h'}[key],exchange,trading_mode:'futures',margin_mode:'isolated',short_allowed:true,stake_currency:'USDT',max_open_trades:limit,stake_amount:stakeAmount,started_at:sessionStart??(startOffset===null?null:(Math.floor(Date.now()/60000)*60000-startOffset)/1000)},portfolio:{starting_balance:startingBalance,profit_all_abs:missingPerformance?null:sign*10,profit_all_pct:missingPerformance?null:sign,profit_closed_abs:missingPerformance?null:sign*10,profit_closed_pct:missingPerformance?null:sign,open_positions:1,max_drawdown:drawdown,closed_trades:key==='medium'?2:closed,winning_trades:wins,losing_trades:losses},open_trades:[trade],history:[trade]}});
  });
  const base='http://127.0.0.1:'+server.address().port;
  let sharedMacroText=null;
  for(const key of keys){
   await page.goto(base+{short:'/demo/short/',medium:'/demo/',long:'/demo/long/'}[key]);
   await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');
   const macro=page.locator('.macro-description');
   assert.equal(await macro.count(),1,'One public macro explanation per bot');
   const macroText=await macro.innerText();
   if(sharedMacroText===null)sharedMacroText=macroText;
   else assert.equal(macroText,sharedMacroText,'Same macro rules described on all three bots');
   assert.match(macroText,/saved daily FRED macro score \(0–100\)/);
   assert.match(macroText,/25 or lower can block new longs; 75 or higher can block new shorts/);
   assert.match(macroText,/Between these limits, there is no extra macro block/);
   assert.match(macroText,/Missing, stale or insufficient macro data lets the technical strategy continue/);
   assert.match(macroText,/All three bots use these rules for new entries only; exits and trade sizes are unchanged/);
   assert.match(macroText,/General headlines remain research flags/);
   assert.match(macroText,/economic event calendar is not connected/);
   assert.match(macroText,/paper trial is enabled; natural entry verification is pending/);
   assert(!/[Â�]|â€/.test(macroText),'Macro text renders without encoding corruption');
   assert.equal(await macro.locator('a').getAttribute('href'),'/#macro-base');
   assert(await macro.evaluate(el=>el.parentElement.classList.contains('decision-flow') && el === el.parentElement.firstElementChild && el.nextElementSibling.classList.contains('decision-flow-arrow') && el.nextElementSibling.nextElementSibling.classList.contains('strategy-description') && !!(el.compareDocumentPosition(document.querySelector('.summary')) & Node.DOCUMENT_POSITION_FOLLOWING)),'Macro explanation leads the arrow and bot strategy before settings');
   for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});
    assert(await page.locator('.decision-flow').evaluate(flow=>{
     const [macro,arrow,bot]=flow.children;
     const m=macro.getBoundingClientRect(),a=arrow.getBoundingClientRect(),b=bot.getBoundingClientRect();
     return m.bottom<=a.top && a.bottom<=b.top && [macro,bot].every(el=>getComputedStyle(el).borderTopStyle==='solid' && el.scrollWidth<=el.clientWidth) && b.right<=innerWidth;
    }),'Bordered macro and bot boxes stack around the arrow on desktop and mobile');
   }
   assert.equal(await page.locator('#openRows tr').count(),1);
   assert.deepEqual(await page.locator('#openRows').evaluate(el=>Array.from(el.closest('table').querySelectorAll('th'),th=>th.textContent)),['Pair','Direction','Entry','Current','Size (USDT)','P/L','Rationale','Opened']);
   assert.equal(await page.locator('#openRows td').count(),8);
   assert.equal(await page.locator('#historyRows td').count(),7);
   for(const [value,expected] of [[997.079,'997.08 USDT'],[0,'0.00 USDT'],[null,'Unavailable'],[-1,'Unavailable'],['1000','Unavailable']]){
    tradeStake=value;await page.evaluate(()=>load());assert.equal(await page.locator('#openRows td:nth-child(5)').innerText(),expected);
   }
   tradeStake=997.079;await page.evaluate(()=>load());
   assert.match(await page.locator('#profit').innerText(),/0.00/);
   assert.equal(await page.locator('#drawdown').innerText(),'-2.40%');
   assert(await page.locator('#drawdown').evaluate(el=>el.classList.contains('neg')));
   assert.equal(await page.locator('#completed').innerText(),'25');
   assert.equal(await page.locator('#maxOpen').innerText(),'4');
   assert.equal(await page.locator('#exchange').innerText(),'Bybit');
   if(key==='medium'){
    for(const [value,expected] of [['kraken','Kraken'],[null,'Unavailable'],['  ','Unavailable']]){
     exchange=value;await page.evaluate(()=>load());assert.equal(await page.locator('#exchange').innerText(),expected);
    }
    exchange='bybit';await page.evaluate(()=>load());
   }
   assert.equal(await page.locator('#winRate').innerText(),'6 wins · 19 losses (24.0%)');
   assert.match(await page.locator('#historyRows').innerText(),/Profit target/);
   assert.equal(await page.locator('.grid>.card').count(),10,'Requested ten summary metrics');
   assert.deepEqual(await page.locator('.grid .label').allTextContents(),['Exchange','Starting balance','Max open positions','Max trade amount','Runtime','Win / loss','Total P/L','Total P/L %','Max drawdown','Completed trades']);
   assert.equal(await page.locator('.summary .grid').count(),2);
   assert.deepEqual(await page.locator('.summary .grid').evaluateAll(rows=>rows.map(row=>row.children.length)),[5,5]);
   assert.deepEqual(await page.locator('.metric-note').allTextContents(),['including open trades','including open trades']);
   assert.equal(await page.locator('.trade-stats #realised').count(),1);
   assert.equal(await page.locator('#runtime').innerText(),'2d 6h');
   for(const value of ['1000',500,0,1000.49,1000.5,'unlimited',null,'bad',true,'',-1]){
    stakeAmount=value;await page.evaluate(()=>load());
    const text=await page.locator('#maxTrade').innerText();
    if(value==='unlimited')assert.equal(text,'Unlimited');
    else if(['1000',500,0,1000.49,1000.5].includes(value))assert.equal(text,new Intl.NumberFormat('en-US',{maximumFractionDigits:0}).format(Number(value))+' USDT');
    else assert.equal(text,'Unavailable');
    assert.equal(await page.locator('#maxTrade.pos,#maxTrade.neg').count(),0);
   }
   stakeAmount='1000';
   for(const [offset,expected] of [[54*3600000,'2d 6h'],[(18*60+42)*60000,'18h 42m'],[42*60000,'42m'],[0,'0m'],[-60000,'Unavailable'],[null,'Unavailable']]){
    startOffset=offset;await page.evaluate(()=>load());assert.equal(await page.locator('#runtime').innerText(),expected);
   }
   startOffset=54*3600000;
   for(const [balance,expected] of [[10000.49,'10,000 USDT'],[10000.5,'10,001 USDT'],[null,'Unavailable']]){
    startingBalance=balance;await page.evaluate(()=>load());assert.equal(await page.locator('#starting').innerText(),expected);
   }
   startingBalance=1000;
   const sessionOffset={short:37*60000,medium:(18*60+42)*60000,long:54*3600000}[key];
   sessionStart=(Math.floor(Date.now()/60000)*60000-sessionOffset)/1000;
   await page.evaluate(()=>load());
   const sessionRuntime=await page.locator('#runtime').innerText();
   assert.equal(sessionRuntime,{short:'37m',medium:'18h 42m',long:'2d 6h'}[key]);
   await page.reload();await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');
   assert.equal(await page.locator('#runtime').innerText(),sessionRuntime,'Session survives page reload');
   sessionStart=Math.floor(Date.now()/60000)*60;
   await page.evaluate(()=>load());assert.equal(await page.locator('#runtime').innerText(),'0m','New real session start resets runtime');
   sessionStart=null;
   await page.evaluate(()=>load());
   assert.deepEqual(await page.locator('#asset-cards article').evaluateAll(els=>els.map(el=>el.dataset.pair)),pairs[key]);
   assert.equal(await page.locator('#raw,#trading-context,#shadow-decisions,#policy-comparison,#settings').count(),0);
   assert(!/secret-debug-version|Freqtrade|Challenger|Admin|veto/i.test(await page.locator('main').innerText()));
   assert.equal(await page.locator('.timeframes [aria-current=page]').count(),1);
   assert.equal(await page.locator('.timeframes [aria-current=page]').innerText(),{short:'15 MIN',medium:'1 HOUR',long:'4 HOUR'}[key]);
   for(const value of [1,-1,0]){
    sign=value;await page.evaluate(()=>load());
    for(const selector of ['#profit','#profitPct','#realised','#openRows td:nth-child(6)','#historyRows td:nth-child(5)']){
     assert.equal(await page.locator(selector).evaluate(el=>el.classList.contains('pos')),value>0,selector);
     assert.equal(await page.locator(selector).evaluate(el=>el.classList.contains('neg')),value<0,selector);
     if(value)assert.equal(await page.locator(selector).evaluate(el=>getComputedStyle(el).color),value>0?'rgb(55, 230, 139)':'rgb(255, 93, 115)');
    }
    assert.equal(await page.locator('#profitPct').innerText(),value>0?'+1.00%':value<0?'-1.00%':'0.00%');
    assert.equal(await page.locator('#openRows td:nth-child(2)').innerText(),value>0?'SHORT':'LONG');
   }
   assert.equal(await page.locator('#balance,#openPos,#realisedPct').count(),0);
   assert.equal(await page.locator('#starting').innerText(),'1,000 USDT');
   for(const selector of ['#profit','#realised','#openRows td:nth-child(6)','#historyRows td:nth-child(5)'])assert.match(await page.locator(selector).innerText(),/\d+\.\d{2} USDT/,'P/L keeps cents');
   for(const value of [0,null,-1]){
    drawdown=value;await page.evaluate(()=>load());
    assert.equal(await page.locator('#drawdown').innerText(),value===0?'0.00%':'Unavailable');
    assert.equal(await page.locator('#drawdown.neg').count(),0);
   }
   drawdown=0.024;
   for(const value of [0,3,-1,null]){
    limit=value;await page.evaluate(()=>load());
    assert.equal(await page.locator('#maxOpen').innerText(),value===-1?'Unlimited':value===null?'Unavailable':String(value));
   }
   limit=4;closed=0;wins=0;losses=0;await page.evaluate(()=>load());
   assert.equal(await page.locator('#completed').innerText(),'0');
   closed=null;wins=null;await page.evaluate(()=>load());assert.equal(await page.locator('#completed').innerText(),'Unavailable');
   closed=30;wins=6;losses=19;await page.evaluate(()=>load());
   assert.equal(await page.locator('#completed').innerText(),key==='medium'?'25':'30');
   closed=25;
   missingPerformance=true;await page.evaluate(()=>load());
   for(const selector of ['#profit','#profitPct','#realised','#openRows td:nth-child(6)','#historyRows td:nth-child(5)']){
    assert.equal(await page.locator(selector).innerText(),'Unavailable');assert(!/pos|neg/.test(await page.locator(selector).getAttribute('class')));
   }
   missingPerformance=false;missingPairs=true;await page.evaluate(()=>load());assert.equal(await page.locator('#asset-cards article').count(),0);assert.match(await page.locator('#asset-cards').innerText(),/unavailable/);
   missingPairs=false;await page.evaluate(()=>load());
   await page.evaluate(()=>renderDemoAssets([]));assert.match(await page.locator('#asset-cards').innerText(),/No configured assets/);
   await page.evaluate(()=>renderDemoAssets(['NEW/USDT:USDT']));assert.equal(await page.locator('#asset-cards article').count(),1);assert.match(await page.locator('#asset-cards').innerText(),/NEW/);assert.match(await page.locator('#asset-cards').innerText(),/Unavailable/);
   await page.evaluate(()=>load());
   for(const width of [320,375,768,1440]){
    await page.setViewportSize({width,height:1000});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+key+' '+width);
    assert(await macro.isVisible(),'Macro explanation visible '+key+' '+width);
    assert.equal(await page.locator('.grid').first().evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>900?5:width>560?2:1);
    assert.equal(await page.locator('#asset-cards').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),width>1100?4:width>600?2:1);
    await page.screenshot({path:path.join(require('node:os').tmpdir(),`rrr-public-${key}-${width}.png`),fullPage:true});
   }
   sign=1;await page.evaluate(()=>load());
   stale=true;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'STALE');assert.equal(await page.locator('#openRows tr').count(),0);assert.equal(await page.locator('#asset-cards article').count(),0);assert.equal(await page.locator('#profit.pos,#profitPct.pos').count(),0);
   for(const id of ['exchange','starting','profit','profitPct','drawdown','realised','completed','maxOpen','maxTrade','runtime','winRate'])assert.equal(await page.locator('#'+id).innerText(),'Unavailable');
   assert.equal(await macro.innerText(),macroText,'Macro rule explanation remains visible when bot readings are stale');
   stale=false;failed=true;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'UNAVAILABLE');assert.equal(await page.locator('#profit').innerText(),'Unavailable');
   assert.equal(await macro.innerText(),macroText,'Macro rule explanation remains visible during feed outages');
   failed=false;sign=0;await page.evaluate(()=>load());assert.equal(await page.locator('#stateBadge').innerText(),'RUNNING');
   marketStale=true;await page.reload();await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');assert.match(await page.locator('#asset-cards').innerText(),/Stale or invalid market data/);marketStale=false;
   researchFailed=true;await page.reload();await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');
   assert.equal(await page.locator('#asset-cards article').count(),pairs[key].length);assert.match(await page.locator('#asset-cards').innerText(),/Unavailable/);researchFailed=false;
  }
  for(const label of ['15 MIN','1 HOUR','4 HOUR']){await page.locator('.timeframes a').filter({hasText:label}).click();await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');}
  assert(calls.every(p=>['/status','/api/demos/short/status','/api/demos/long/status','/score','/api/market-summary'].includes(p)),'No diagnostics requested publicly');
  await page.goto(base+'/website/demo/');await page.waitForFunction(()=>document.getElementById('stateBadge').textContent==='RUNNING');assert.equal(await page.locator('#exchange').innerText(),'Bybit');
  await page.goto(base+'/');assert(await page.locator('body').isVisible());
  assert.deepEqual(errors,[]);
  console.log('PASS public presentation: consistent macro entry explanations, direction boundaries, unavailable input behaviour, pending execution verification, macro link, ten cards, signed P/L and percentages, positive/negative/zero/unavailable colouring, bot-specific assets, missing/stale/failed research, three demos, timeframe navigation, zero/missing values, stale/outage/recovery, private diagnostics absent, 320/375/768/1440 layouts, homepage, no page errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
