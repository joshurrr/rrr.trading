// Focused homepage panel checks. All remote feeds are mocked.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
  if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
  fs.readFile(file,(error,data)=>{if(error)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(data);});
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[],legacyRequests=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.route('**/radio-navigation.js*',r=>r.fulfill({body:'',contentType:'application/javascript'}));
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>{legacyRequests.push(r.request().url());return r.fulfill({status:503});});
  let state='loading',release;
  const gate=new Promise(resolve=>release=resolve);
  await page.route('https://v4.rrr.trading/**',async r=>{
   assert.equal(r.request().url(),'https://v4.rrr.trading/v4/paper');assert.equal(r.request().method(),'GET');
   assert.equal(r.request().headers().authorization,undefined);assert.equal(r.request().headers().cookie,undefined);
   requests.push(r.request().url());if(state==='loading')await gate;
   if(state==='error')return r.fulfill({status:503});
   const at=new Date(Date.now()-10000).toISOString(),source=new Date(Date.now()-20000).toISOString();
   const end=new Date(Date.now()+(state==='expires'?1200:state==='expired'?-1:600000)).toISOString();
   const section=()=>({state:'CURRENT',observed_at:at,source_at:source,expires_at:end,provenance:{source:'saved_fixture'}});
   const row=(side,symbol,move)=>({...section(),observed_at:source,side,symbol,exchange:'bybit',rank:1,timeframe:'1h',momentum_support:'FAVOURS',return_pct:move});
   const overview={version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',
    breadth:{...section(),health:'PARTIAL',values:{rising_24h_pct:60,falling_24h_pct:35,assets_included:50,median_change_24h_pct:-0.25}},
    fear_greed:{...section(),values:{value:25,classification:'Fear',change_points:5}},
    research:{...section(),status:'OK',counts:{assets_evaluated_for_ranking:50,assets_technically_assessed:2,eligible_pool_assets:60}},
    shortlists:{LONG:{...section(),purpose:'RESEARCH_RANKING_ONLY',items:[row('LONG','BTCUSDT',3)]},SHORT:{...section(),purpose:'RESEARCH_RANKING_ONLY',items:[row('SHORT','ETHUSDT',-4)]}},
    sentiment:{...section(),context_state:'CURRENT',status:'USABLE',market_direction:'DOWN',assessment_timestamp:source,entry_expires_at:end},
    paper_trading:{...section(),mode:'paper',status:'ATTENTION',reasons:['position_monitoring_incomplete'],monitoring:{status:'ATTENTION',unmonitored:[{symbol:'BTCUSDT'}]}}};
   const data={version:'paper-read-api-v1',mode:state==='live'?'live':'paper',served_at:new Date().toISOString(),overview,
    // Deliberately conflicting legacy fields: only overview may populate this panel.
    sentiment:{market_direction:'UP'},latest_cycle:{status:'OK'},private_admin:{secret:'NOT_FOR_PUBLIC_PANEL'}};
   if(['bullish','bearish','balanced'].includes(state)) {
    overview.breadth.health='AVAILABLE';
    overview.breadth.values.rising_24h_pct=state==='bearish'?20:state==='balanced'?50:70;
    overview.breadth.values.falling_24h_pct=state==='bearish'?80:state==='balanced'?50:30;
    overview.sentiment.market_direction=state==='bullish'?'UP':'DOWN';
   }
   if(state==='conflict')overview.breadth.health='AVAILABLE';
   if(state==='bad-breadth')overview.breadth.values.rising_24h_pct=120;
   if(state==='historical'){overview.sentiment.state='STALE';overview.sentiment.context_state='CONTEXT_ONLY';overview.sentiment.status='BLOCKED';overview.breadth.state='STALE';}
   if(state==='blocked')overview.sentiment.context_state='BLOCKED';
   if(state==='stale')for(const key of ['breadth','fear_greed','research','sentiment','paper_trading'])overview[key].state='STALE';
   if(state==='zero'){
    overview.fear_greed.values.value=0;overview.breadth.values.rising_24h_pct=0;
    overview.research.counts={assets_evaluated_for_ranking:0,assets_technically_assessed:0,eligible_pool_assets:0};
    overview.shortlists.LONG.items=[];overview.shortlists.SHORT.items=[];
    overview.paper_trading.monitoring={status:'OK',unmonitored:[]};
   }
   if(state==='missing'){delete overview.fear_greed;overview.paper_trading={state:'UNAVAILABLE'};}
   if(state==='legacy')delete data.overview;
   if(state==='unknown'){
    overview.fear_greed.values.value=null;overview.breadth.values.rising_24h_pct=false;
    overview.research.counts.assets_evaluated_for_ranking=null;overview.paper_trading.monitoring.unmonitored=null;
   }
   if(state==='unsafe'){overview.paper_trading.reasons=['<img src=x onerror="window.BAD=1">'];overview.shortlists.LONG.items[0].symbol='<img src=x onerror="window.BAD=1">';}
   if(state==='mixed'){overview.shortlists.SHORT.state='STALE';overview.shortlists.SHORT.items[0].state='STALE';}
   if(state==='row-expired')overview.shortlists.SHORT.items[0].expires_at=new Date(Date.now()-1).toISOString();
   if(state==='many')for(const side of ['LONG','SHORT'])overview.shortlists[side].items=Array.from({length:9},(_,i)=>({...row(side,'ASSET'+i+'USDT',side==='LONG'?9-i:i-9),rank:i+1,decision:{outcome:['CANDIDATE','WAIT','BLOCKED'][i%3],evaluated_at:at}}));
   if(state==='future')overview.breadth.observed_at=new Date(Date.now()+60000).toISOString();
   return r.fulfill({json:data});
  });
  await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#v4-sentiment-state').innerText(),'LOADING');
  state='fresh';release();await page.waitForFunction(()=>document.querySelector('#v4-overview').getAttribute('aria-busy')==='false');
  assert.doesNotMatch(await page.locator('body').innerText(),/\bpaper\b/i);
  assert.equal(await page.locator('#v4-sentiment-state').innerText(),'CURRENT');
  assert.match(await page.locator('#v4-sentiment-time').innerText(),/Source:.*AEST.*Expires:/);
  assert.match(await page.locator('#v4-sentiment-value').innerText(),/Downward/,'uses overview, not conflicting legacy direction');
  assert.match(await page.locator('#v4-paper-detail').innerText(),/1 unmonitored demo position/);
  assert.equal(await page.locator('#v4-overview [data-v4-section]').count(),6);
  const card=key=>page.locator('#v4-overview [data-v4-section="'+key+'"]');
  assert.match(await card('breadth').innerText(),/60% rising · 35% falling/);
  assert.match(await card('breadth').innerText(),/50 assets · median -0.25% · partial coverage/);
  assert.match(await card('fear_greed').innerText(),/25 \/ 100/);
  assert.match(await card('research').innerText(),/50 assessed for ranking/);
  assert.match(await card('research').innerText(),/2 technical · 60 eligible pool/);
  assert.match(await card('shortlists').innerText(),/LONG .* CURRENT/);
  assert.match(await card('shortlists').innerText(),/SHORT .* CURRENT/);
  assert.equal(await page.locator('#v4-overview .v4-state').filter({hasText:'UNAVAILABLE'}).count(),0);
  assert(!await page.locator('#v4-overview').innerText().then(t=>t.includes('NOT_FOR_PUBLIC_PANEL')));
  assert.equal(await page.locator('#v4-overview a').getAttribute('href'),'https://v4.rrr.trading');
  assert.equal(await page.locator('[data-site-header] .brand').count(),1);
  assert.match(await page.locator('[data-site-header]').innerText(),/OVERVIEW/);
  assert.equal(await page.locator('#radio-audio').count(),1);
  assert.equal(await page.locator('footer.site-legal-footer').count(),1);
  const portraits=card('shortlists').locator('.candidate-portrait');
  assert.equal(await portraits.count(),2);
  assert.equal(await portraits.first().locator('.candidate-score-label').textContent(),'1h price return · not a score');
  assert.equal(await portraits.first().locator('.universe-score').innerText(),'3%');
  assert.match(await portraits.first().textContent(),/Trade decision unavailable/);
  const beforeModal=legacyRequests.length;
  const button=portraits.first().locator('button');await button.focus();await page.keyboard.press('Enter');
  await page.locator('#asset-intelligence-dialog').waitFor({state:'visible'});
  assert.match(await page.locator('#asset-intelligence-dialog').innerText(),/V4 DEMO RESEARCH/);
  assert.match(await page.locator('#asset-intelligence-dialog').innerText(),/BTCUSDT/);
  assert.doesNotMatch(await page.locator('#asset-intelligence-dialog').innerText(),/Loading asset intelligence|V2 DECISIONS/);
  assert.equal(legacyRequests.length,beforeModal,'V4 modal never requests V3 evidence');
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  assert(await button.evaluate(n=>n===document.activeElement),'modal returns focus');
  await page.waitForTimeout(1100);assert(await button.evaluate(n=>n===document.activeElement),'clock render preserves card focus');
  const artifacts=path.join(__dirname,'.runtime','v4-overview');fs.mkdirSync(artifacts,{recursive:true});
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});
   const nav=page.locator('.operating-modes'),v4=nav.getByRole('link',{name:'V4 TRADING',exact:true});
   assert.equal(await v4.count(),1);assert.equal(await v4.getAttribute('href'),'https://v4.rrr.trading');
   assert.equal(await nav.locator('#bots-shortcuts,.bots-menu-toggle,a[href="/bots/"],a[href*="15minbot"],a[href*="1hrbot"],a[href*="4hrbot"]').count(),0);
   assert.equal(await nav.getByRole('link',{name:'OVERVIEW',exact:true}).count(),1);
   assert.equal(await nav.getByRole('link',{name:'TOOLS',exact:true}).count(),1);
   await v4.focus();assert(await v4.evaluate(n=>n===document.activeElement));
   const menu=page.locator('#intelligence-shortcuts'),toggle=page.locator('[aria-controls="intelligence-shortcuts"]');
   await toggle.focus();await toggle.press('ArrowDown');
   assert(await menu.isVisible());
   assert.deepEqual(await menu.locator('a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href'))),
     ['/asset-explorer/','/market-conditions/','/research-news/','/trading-assessment/','/schedule/']);
   assert.equal(await page.locator('a[href*="crypto-scanner"]').count(),0);
   assert(await menu.locator('a').first().evaluate(n=>n===document.activeElement));
   await page.keyboard.press('Escape');assert(await menu.isHidden());

   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'page overflow at '+width);
   await page.screenshot({path:path.join(artifacts,'homepage-'+width+'.png'),fullPage:true});
  }
  async function refresh(next){state=next;await page.evaluate(()=>refreshV4Overview());}
  assert.equal(await page.locator('#v4-overview-title').innerText(),'MARKET OVERVIEW');
  assert.equal(await page.locator('#v4-overview .v4-eyebrow').count(),0);
  assert.equal(await page.locator('#v4-overview .v4-market-indicators [data-v4-section]').count(),3);
  assert.match(await page.locator('#market-condition-headline').innerText(),/MIXED MARKET/,'partial coverage cannot establish consensus');
  await refresh('bullish');assert.match(await page.locator('#market-condition-headline').innerText(),/UPWARD PRESSURE/);
  assert.equal(await page.locator('.v4-market-briefing').getAttribute('data-tone'),'positive');
  await refresh('bearish');assert.match(await page.locator('#market-condition-headline').innerText(),/DOWNWARD PRESSURE/);
  assert.equal(await page.locator('.v4-market-briefing').getAttribute('data-tone'),'negative');
  await refresh('conflict');assert.match(await page.locator('#market-condition-headline').innerText(),/NO DIRECTIONAL CONSENSUS/);
  await refresh('bad-breadth');assert.match(await page.locator('#market-condition-headline').innerText(),/INCOMPLETE/);
  await refresh('balanced');assert.match(await page.locator('#market-condition-headline').innerText(),/MIXED MARKET/);
  await refresh('historical');assert.equal(await page.locator('#v4-sentiment-state').innerText(),'STALE');
  assert.match(await page.locator('#v4-sentiment-detail').innerText(),/CONTEXT_ONLY/);
  assert.match(await page.locator('#market-condition-headline').innerText(),/INCOMPLETE/);
  assert.match(await page.locator('#market-condition-explanation').innerText(),/historical AI interpretation/);
  assert.equal(await card('fear_greed').locator('.v4-state').innerText(),'CURRENT','independent fresh indicator survives stale breadth');

  await page.locator('#v4-overview').screenshot({path:path.join(artifacts,'stale-390.png')});
  await refresh('expires');assert.equal(await page.locator('#v4-sentiment-state').innerText(),'CURRENT');
  await page.waitForFunction(()=>document.querySelector('#v4-sentiment-state').textContent==='STALE');
  assert.match(await page.locator('#v4-sentiment-detail').innerText(),/expired/);
  assert.match(await page.locator('#market-condition-headline').innerText(),/INCOMPLETE/);
  await refresh('blocked');assert.equal(await page.locator('#v4-sentiment-state').innerText(),'UNAVAILABLE');
  await refresh('stale');assert.equal(await page.locator('#v4-paper-state').innerText(),'STALE');
  await refresh('expired');assert.equal(await card('breadth').locator('.v4-state').innerText(),'STALE');
  assert.equal(await card('shortlists').locator('.v4-state').innerText(),'STALE');
  await refresh('mixed');assert.match(await card('shortlists').innerText(),/TOP LONG OPPORTUNITIES .* CURRENT/);assert.match(await card('shortlists').innerText(),/TOP SHORT OPPORTUNITIES .* STALE/);
  await card('shortlists').locator('.v4-shortlist-side').nth(1).locator('.universe-bubble').click();
  assert.match(await page.locator('#asset-intelligence-dialog').innerText(),/STALE .* historical research ranking/);
  assert.match(await page.locator('#asset-intelligence-dialog').innerText(),/SHORT/);
  await page.keyboard.press('Escape');await page.waitForTimeout(300);
  await refresh('row-expired');assert.match(await card('shortlists').innerText(),/TOP LONG OPPORTUNITIES .* CURRENT/);assert.match(await card('shortlists').innerText(),/TOP SHORT OPPORTUNITIES .* STALE/);
  await refresh('many');assert.match(await card('shortlists').innerText(),/showing 8 of 9/);
  assert.equal(await portraits.count(),16);assert.doesNotMatch(await card('shortlists').innerText(),/ASSET8USDT/);
  for(const width of [1440,390]) {
   await page.setViewportSize({width,height:1000});
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const side=card('shortlists').locator('.v4-shortlist-side').first(),track=side.locator('.universe-grid');
   assert.deepEqual(await side.locator('.candidate-portrait').evaluateAll(ns=>ns.map(n=>n.dataset.symbol)),Array.from({length:8},(_,i)=>'ASSET'+i));
   assert.match(await side.innerText(),/Recorded CANDIDATE/);assert.match(await side.innerText(),/Recorded WAIT/);assert.match(await side.innerText(),/Recorded BLOCKED/);
   const next=side.getByRole('button',{name:'Next assets'});await next.click();
   await page.waitForFunction(()=>document.querySelector('#v4-long-opportunities').scrollLeft>0);
   await side.getByRole('button',{name:'Previous assets'}).click();
   await page.waitForTimeout(400);
   await page.locator('#v4-overview').screenshot({path:path.join(artifacts,'eight-rows-'+width+'.png')});
  }
  await refresh('zero');assert.match(await page.locator('#v4-paper-detail').innerText(),/no unmonitored positions/);
  assert.match(await card('fear_greed').innerText(),/0 \/ 100/);assert.match(await card('research').innerText(),/0 assessed for ranking/);
  assert.match(await card('shortlists').innerText(),/No ranked opportunities recorded/);
  await refresh('unknown');assert.match(await page.locator('#market-condition-headline').innerText(),/INCOMPLETE/);assert.match(await card('fear_greed').innerText(),/Unknown \/ 100/);assert.match(await card('research').innerText(),/unknown assessed/);
  assert.match(await page.locator('#v4-paper-detail').innerText(),/unknown/);
  await refresh('missing');assert.equal(await card('fear_greed').locator('.v4-state').innerText(),'UNAVAILABLE');
  assert.equal(await card('breadth').locator('.v4-state').innerText(),'CURRENT','missing section does not erase available observations');
  await refresh('future');assert.equal(await card('breadth').locator('.v4-state').innerText(),'UNAVAILABLE');
  await refresh('unsafe');assert.equal(await card('shortlists').locator('.v4-shortlist-side').first().locator('img').count(),0);assert.equal(await page.evaluate(()=>window.BAD),undefined);
  for(const next of ['error','live','legacy']){await refresh(next);assert.equal(await page.locator('#v4-sentiment-state').innerText(),'UNAVAILABLE');assert.match(await page.locator('#v4-overview-status').innerText(),/unavailable/);}
  await page.locator('#v4-overview').screenshot({path:path.join(artifacts,'unavailable-390.png')});
  assert(requests.length>1);assert.deepEqual(errors,[]);
  console.log('V4 overview: desktop/mobile, actual overview fields, independent LONG/SHORT, desktop/mobile, preserved header/radio/footer, expiry, partial/missing/error states, zero versus unknown, safe text and GET-only checks passed.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
