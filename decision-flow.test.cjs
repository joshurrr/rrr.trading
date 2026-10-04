const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
async function run(){
 const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.join(__dirname,pathname.endsWith('/')?pathname+'index.html':pathname);
  if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let flowFail=true,statusFail=false,stale=false,wrong=false,final='NO SIGNAL';const calls=[];
  await page.route('https://api.rrr.trading/**',async route=>{
   const endpoint=new URL(route.request().url()).pathname;calls.push(endpoint);
   const diagnostic=endpoint.endsWith('decision-flow');
   if(diagnostic?flowFail:statusFail)return route.fulfill({status:503,json:{ok:false}});
   const generated_at=Date.now()/1000-(stale?90:0);
   if(!diagnostic)return route.fulfill({json:{ok:true,demo:wrong?'short':'long',generated_at,bot:{strategy:'Long Term 4hr',timeframe:'4h',mode:'PAPER',state:'RUNNING',exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,pairs:['INJ/USDT:USDT'],max_open_trades:4,stake_amount:'1000',started_at:generated_at-3600},portfolio:{starting_balance:10000,profit_all_abs:9.84,profit_all_pct:.1,max_drawdown:0,closed_trades:0,winning_trades:0,losing_trades:0},open_trades:[{pair:'INJ/USDT:USDT',direction:'LONG',open_rate:7.56,current_rate:7.64,stake_amount:999.96,profit_abs:9.84,profit_pct:.98,open_date:'2026-10-04 02:00:43',entry_tag:'private-tag'}]}});
   return route.fulfill({json:{ok:true,bot:wrong?'short':'long',timeframe:'4h',generated_at,
    market_scan:[{pair:'INJ/USDT:USDT',state:'OPEN'},{pair:'ETH/USDT:USDT',state:'UNKNOWN'}],
    technical:{state:'UNKNOWN',pair:'ETH/USDT:USDT',timestamp:'2026-10-04T04:00:00Z',values:{ema20:100,rsi:0}},daily_trend:{state:'UNKNOWN',values:{},fresh:false},
    traderouter:{state:'FAIL-OPEN',macro:{fresh:false},research_flags:'UNKNOWN'},risk:{state:'UNKNOWN',open_positions:1,max_open_positions:4,stake_amount:'1000',capacity:'AVAILABLE'},
    final_decision:{state:final,pair:'ETH/USDT:USDT',timestamp:'2026-10-04T04:00:00Z',reason:'Actual backend reason <img src=x onerror=alert(1)>',order_sent:'UNKNOWN'},
    last_decision:{timestamp:'2026-10-04T04:00:00Z',pair:'ETH/USDT:USDT',state:'UNKNOWN',reason:'Order outcome unknown'},
    history_state:'AVAILABLE',recent_decisions:[{timestamp:'2026-10-04T04:00:00Z',pair:'ETH/USDT:USDT',state:'UNKNOWN',reason:'Order outcome unknown'}],exit_monitoring:[{pair:'INJ/USDT:USDT',exit_signal:'INACTIVE',trailing_stop:'UNKNOWN'}]}});
  });
  const base='http://127.0.0.1:'+server.address().port;
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.goto(base+'/demo/rrr-trading-4hr-v2.html');
  assert.equal(new URL(page.url()).pathname,'/demo/long/');
  assert.deepEqual(await page.locator('#demo-options a').allTextContents(),['15 Min','1 Hour','4 Hour']);
  assert.equal(await page.locator('#demo-options [data-selected]').getAttribute('data-demo'),'long');
  assert.equal(await page.locator('.tabs a').count(),3);
  assert(!/V2/.test(await page.locator('main').innerText()));
  await page.goto(base+'/demo/long/');
  await page.waitForFunction(()=>document.querySelector('#bot-state').textContent==='RUNNING'&&document.querySelector('#flow-status').textContent.includes('UNAVAILABLE'));
  assert.equal(await page.locator('#final .big').innerText(),'UNKNOWN');
  assert.equal(await page.locator('#profit').innerText(),'9.84 USDT');
  assert.match(await page.locator('#open-trades').innerText(),/INJ/);
  assert(!/private-tag|82,944|58\.2|1\.34|63 \/ 100|01:38:12/.test(await page.locator('main').innerText()));
  assert.equal(await page.getByRole('link',{name:'4 HOUR',exact:true}).getAttribute('href'),'/demo/long/');
  flowFail=false;await page.evaluate(()=>loadDecisionFlow());
  assert.equal(await page.locator('#final .big').innerText(),'NO SIGNAL');
  assert.equal(await page.locator('#technical.pass').count(),0);
  assert.match(await page.locator('#technical').innerText(),/RSI\s+0/);
  assert.match(await page.locator('#daily').innerText(),/STALE/);
  assert.equal(await page.locator('#flow img').count(),0,'Backend text escaped');
  assert.match(await page.locator('#last-decision').innerText(),/4\/10\/2026/);
  for(const decision of ['LONG','SHORT','WAIT','BLOCKED BY TECHNICAL','BLOCKED BY DAILY TREND','BLOCKED BY MACRO','BLOCKED BY CONTEXT','BLOCKED BY RISK','MAX POSITIONS','POSITION ALREADY OPEN','ORDER SENT','UNKNOWN']){
   final=decision;await page.evaluate(()=>loadDecisionFlow());assert.equal(await page.locator('#final .big').innerText(),decision);
  }
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No horizontal page overflow at '+width);
   await page.screenshot({path:path.join(os.tmpdir(),'rrr-decision-flow-'+width+'.png'),fullPage:true});
  }
  flowFail=true;await page.evaluate(()=>loadDecisionFlow());
  assert.equal(await page.locator('#final .big').innerText(),'UNKNOWN');
  assert.equal(await page.locator('#bot-state').innerText(),'RUNNING');
  assert.equal(await page.locator('#recent-decisions.stale').count(),1);
  flowFail=false;stale=true;await page.evaluate(()=>loadDecisionFlow());
  assert.equal(await page.locator('#bot-state').innerText(),'STALE');
  assert.equal(await page.locator('#final .big').innerText(),'UNKNOWN');
  stale=false;wrong=true;await page.evaluate(()=>loadDecisionFlow());
  assert.equal(await page.locator('#bot-state').innerText(),'UNAVAILABLE');
  wrong=false;statusFail=true;await page.evaluate(()=>loadDecisionFlow());
  assert.equal(await page.locator('#settings.stale').count(),1);
  assert.equal(await page.locator('#flow.stale').count(),0,'Independent diagnostic recovery');
  statusFail=false;await page.evaluate(()=>loadDecisionFlow());
  assert.equal(await page.locator('#bot-state').innerText(),'RUNNING');
  let navigations=0;page.on('framenavigated',()=>navigations++);
  const before=calls.length;await page.waitForTimeout(16000);
  assert(calls.length>before,'15 second polling');assert.equal(navigations,0,'DOM refresh without page reload');
  assert(calls.every(p=>['/api/demos/long/status','/api/demos/long/decision-flow'].includes(p)));
  assert.deepEqual(errors,[]);
  console.log('PASS 4hr decision flow: separate routes, real-feed schema, missing endpoint, stale/outage/recovery, unknown outcomes, supported decisions, independent panels, escaping, 15s DOM polling and 320/390/768/1440 layouts.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
module.exports=run;
if(require.main===module)run().catch(e=>{console.error(e);process.exitCode=1;});
