const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// Synthetic evidence only. No production writes or trading calculations.
(async () => {
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://localhost').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[],writes=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('request',r=>{if(r.url().startsWith('https://api.rrr.trading')&&r.method()!=='GET')writes.push(r.url());});
  await page.addInitScript(()=>sessionStorage.setItem('rrr.trading.v3.loaded-generation','2026-10-14T00:00:00Z'));
  let mode='fresh', delay=0;const now=()=>new Date().toISOString();
  const state=(bias)=>({available:true,freshness:'fresh',generated_at:now(),bias,score:63,confidence:.7,long_permission:'ALLOWED',short_permission:'BLOCKED'});
  const detail=symbol=>({asset:{symbol,name:symbol==='BTC'?'Bitcoin':'Ethereum',exchange:'bybit',market_type:'linear_perpetual'},api_version:'fixture',overall_state:{...state('BULLISH'),overall_bias:'BULLISH'},timeframes:{'15m':state('NEUTRAL'),'1h':state('BULLISH'),'4h':state('BEARISH')},market:{available:true,freshness:'FRESH',timestamp:now(),refresh_interval_seconds:60,price:100,price_change_24h:2,derivatives_bias:'BULLISH',volatility_state:'LOW',liquidity_state:'HIGH'},decision:{id:1,available:true,freshness:'FRESH',shadow_mode:true,execution_connected:false,decision:'BLOCKED',decision_time:now(),evidence_expires_at:new Date(Date.now()+120000).toISOString(),evidence:{configuration:{decision_max_age_seconds:600}},reason_summary:'Existing position blocks a new entry'},execution:{health:{mode:'PAPER',status:'available',stale:false,last_run:now(),run_id:'v3-paper-fixture',started_at:'2026-10-15T00:00:00Z',enabled:true},active_position:true,latest_execution:{opportunity_id:9,sizing_id:10,status:'OPEN',payload:{why_go:'Original bullish setup <script>alert(1)</script>',why_horizon:'1h',why_direction:'LONG'},execution_price:99,executed_stake:100,leverage:2}}});
  await page.route('**/radio-navigation.js*',r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',async r=>{
   const p=new URL(r.request().url()).pathname;
   if(p==='/api/system/generation')return r.fulfill({json:{generation:3,application:'RRR.Trading V3',phase:'ACTIVE',entries_blocked:false,factory_reset_at:'2026-10-14T00:00:00Z',run_id:'v3-paper-fixture'}});
   if(p==='/api/trading-universe')return r.fulfill({json:{status:'ok',schema_version:1,entry_eligible:true,universe_version:'fixture',generated_at:now(),valid_until:new Date(Date.now()+600000).toISOString(),assets:'BTC ETH SOL XRP LINK ONDO AAVE UNI HYPE INJ'.split(' ').map((symbol,i)=>({symbol,pair:symbol+'/USDT:USDT',rank:i+1,reason:'Fixture selection evidence',opportunity_score:80-i,data_confidence:.8,trend:'positive'}))}});
   if(p.endsWith('/reporting')) {
    if(mode==='missing')return r.fulfill({status:503});
    return r.fulfill({json:{available:true,run_id:mode==='wrong-run'?'other-run':'v3-paper-fixture',started_at:'2026-10-15T00:00:00Z',observed_at:now(),portfolio:{},open_trades:p.includes('/short/')?[{id:1,pair:'BTC/USDT:USDT',amount:2,open_date:now(),entry_tag:'v2paper:9:10',direction:'LONG',open_rate:99,stake_amount:100,leverage:2,profit_abs:2,profit_pct:2}]:[],history:p.includes('/short/')?[{id:2,pair:'BTC/USDT:USDT',open_date:now(),close_date:now(),direction:'LONG',open_rate:101,close_rate:100,stake_amount:100,profit_abs:-1,profit_pct:-1,exit_reason:'trend_break'}]:[]}});
   }
   const m=/\/api\/v2\/intelligence\/assets\/([A-Z0-9]+)(?:\/(news|events))?$/.exec(p);
   if(!m)return r.fulfill({status:503});
   if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   if(mode==='error')return r.fulfill({status:503});
   if(mode==='not-found')return r.fulfill({status:404});
   if(m[2])return r.fulfill({json:{asset:{symbol:m[1]},status:'ok',[m[2]]:m[2]==='news'?Array.from({length:6},(_,i)=>({headline:`Article ${i} <script>`,source:'Fixture',published_at:now(),relevance_score:.95-i*.01,freshness:'fresh',source_url:i===0?'javascript:alert(1)':'https://example.test/'+i})):[]}});
   const d=detail(m[1]);if(mode==='stale'){d.market.timestamp='2000-01-01';d.market.freshness='STALE';d.overall_state.generated_at='2000-01-01';d.decision.available=false;d.decision.freshness='STALE';d.timeframes['1h'].generated_at='2000-01-01';d.execution.health.last_run='2000-01-01';}
   if(mode==='missing'){delete d.market;delete d.decision;delete d.execution;d.timeframes={};delete d.overall_state;}
   if(mode==='future'){d.market.timestamp=new Date(Date.now()+60000).toISOString();d.overall_state.generated_at=d.market.timestamp;d.timeframes['1h'].generated_at=d.market.timestamp;d.decision.decision_time=d.market.timestamp;}
   return r.fulfill({json:d});
  });
  const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base);
  const dialog=page.locator('#asset-intelligence-dialog'), close=page.getByRole('button',{name:'Close asset intelligence'});
  const open=async()=>{await page.evaluate(()=>AssetIntelligence.open('BTC'));await page.waitForSelector('#ai-tab-0');};
  const firstCard=page.locator('.universe-bubble').first();await firstCard.waitFor();await firstCard.focus();await firstCard.press('Enter');await page.waitForSelector('#ai-tab-0');assert.equal(await page.getByRole('tab').count(),5);assert.equal(await page.getByRole('tab',{name:'Overview',exact:true}).getAttribute('aria-selected'),'true');
  assert.match(await page.locator('.ai-summary-header').innerText(),/100 USDT.*\+2%/s);assert.match(await page.locator('.ai-summary-header').innerText(),/Active paper position.*New entry: BLOCKED.*Overall: BULLISH/s);
  assert(!(await dialog.innerText()).includes('Collector version'));assert.match(await dialog.innerText(),/Existing position blocks a new entry/);
  assert(await close.evaluate(e=>e===document.activeElement));await close.focus();await page.keyboard.press('Shift+Tab');assert(await page.evaluate(()=>document.activeElement.closest('#asset-intelligence-dialog')!==null));await page.keyboard.press('Tab');assert(await close.evaluate(e=>e===document.activeElement));
  await page.getByRole('tab',{name:'Trades',exact:true}).click();await page.waitForSelector('.ai-pnl');
  assert.match(await page.locator('#ai-panel-1').innerText(),/Original bullish setup <script>/);assert.match(await page.locator('#ai-panel-1').innerText(),/Historical evidence unavailable/);
  assert.equal(await page.locator('.ai-pnl[data-tone=positive]').count(),1);assert.equal(await page.locator('.ai-pnl[data-tone=negative]').count(),1);
  assert.match(await page.locator('#ai-panel-1').innerText(),/Not applicable · open trade/);assert.match(await page.locator('#ai-panel-1').innerText(),/trend break/);
  await page.getByRole('tab',{name:'Intelligence',exact:true}).click();assert.equal(await page.locator('.ai-comparison tbody tr').count(),3);assert.match(await page.locator('.ai-comparison').innerText(),/15m.*NEUTRAL.*1h.*BULLISH.*4h.*BEARISH/s);
  await page.getByRole('tab',{name:'News & Market',exact:true}).click();await page.waitForSelector('.ai-brief-story');assert.equal(await page.locator('.ai-brief-story:visible').count(),3);
  await page.getByRole('button',{name:'Show 3 more articles'}).click();assert.equal(await page.locator('.ai-brief-story:visible').count(),6);await page.getByRole('button',{name:'Show fewer articles'}).click();assert.equal(await page.locator('.ai-brief-story:visible').count(),3);
  assert.equal(await page.locator('#ai-news-brief a[href^="javascript:"]').count(),0);assert.equal(await page.locator('dialog script, dialog img').count(),0);
  await page.getByRole('tab',{name:'Advanced',exact:true}).click();assert(await page.locator('#ai-market').isVisible());assert(await page.locator('#ai-decision').isVisible());assert(await page.getByText('Full API evidence',{exact:true}).isVisible());
  await page.getByRole('tab',{name:'Overview',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Trades',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await page.getByRole('tab',{name:'Advanced',exact:true}).getAttribute('aria-selected'),'true');await page.keyboard.press('Home');
  fs.mkdirSync('.runtime/modal-tabs',{recursive:true});
  for(const width of [320,375,768,1440]){
   await page.setViewportSize({width,height:800});
   for(const name of ['Overview','Trades','Intelligence','News & Market','Advanced']){
    await page.getByRole('tab',{name,exact:true}).click();
    assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),`${name} overflow ${width}`);
    await page.locator('.ai-content').evaluate(e=>e.scrollTop=e.scrollHeight);
    assert(await page.locator('.ai-header').evaluate(e=>e.getBoundingClientRect().top>=0));
    assert(await page.locator('.ai-content').evaluate(e=>e.clientHeight>100));
    if([375,1440].includes(width))await page.screenshot({path:`.runtime/modal-tabs/${name.replaceAll(' ','-')}-${width}.png`});
   }
  }
  await close.click();await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
  for(const testMode of ['stale','missing','wrong-run','future']){mode=testMode;await open();
   if(mode==='stale'){assert.match(await page.locator('.ai-summary-header').innerText(),/stale or unverified/);assert(!(await page.locator('.ai-summary-header').innerText()).includes('Active paper position'));await page.getByRole('tab',{name:'Intelligence',exact:true}).click();assert.match(await page.locator('.ai-comparison tbody tr').nth(1).innerText(),/Stale/);}
   if(mode==='missing')assert.match(await page.locator('.ai-summary-header').innerText(),/not collected/);
   if(mode==='future'){assert.match(await page.locator('.ai-summary-header').innerText(),/unverified/);assert(!(await page.locator('.ai-summary-header').innerText()).includes('Overall: BULLISH'));}
   await page.getByRole('tab',{name:'Trades',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('#ai-panel-1').textContent.includes('Loading'));
   if(mode==='wrong-run')assert.equal(await page.locator('.ai-pnl').count(),0);
   await close.click();await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
  }
  // Cancellation, switching assets and synchronous native close/reopen.
  delay=400;await page.evaluate(()=>{AssetIntelligence.open('BTC');});assert.match(await dialog.innerText(),/Loading asset intelligence/);await page.evaluate(()=>AssetIntelligence.open('ETH'));await page.waitForFunction(()=>document.querySelector('#ai-title').textContent==='ETH — Ethereum');assert(!(await page.locator('.ai-summary-header').innerText()).includes('BTC'));delay=0;
  await page.evaluate(()=>{document.querySelector('#asset-intelligence-dialog').close();AssetIntelligence.open('BTC');});await page.waitForSelector('#ai-tab-0');assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await close.click();await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  mode='error';await page.evaluate(()=>AssetIntelligence.open('BTC'));await page.getByRole('button',{name:'Retry',exact:true}).waitFor();mode='fresh';await page.getByRole('button',{name:'Retry',exact:true}).click();await page.waitForSelector('#ai-tab-0');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
  mode='not-found';await page.evaluate(()=>AssetIntelligence.open('BTC'));assert.match(await dialog.innerText(),/Asset not found/);await close.click();await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
  mode='fresh';await open();await page.mouse.click(1,1);await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
  for(const route of ['15minbot','1hrbot','4hrbot','slingshot']){
   await page.goto(base+'/demo/'+route+'/');
   const trigger=page.locator('[data-intelligence-symbol="BTC"]').first();await trigger.waitFor();await trigger.click();await page.waitForSelector('#ai-tab-0');
   for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:800});assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1));}
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);assert(await trigger.evaluate(e=>e===document.activeElement));
  }
  mode='fresh';await page.clock.install();await open();await page.clock.fastForward(121000);assert.match(await page.locator('.ai-summary-header').innerText(),/price stale or unverified/);assert.match(await page.locator('.ai-summary-header').innerText(),/New entry: Stale/);await close.click();await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
  await page.clock.resume();await page.clock.setSystemTime(new Date());
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log('PASS modal tabs: summary, original rationale/new entry, trade P&L/run matching, safe news expansion, Advanced evidence, keyboard, freshness expiry, missing/stale, 320/375/768/1440.');
 } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
