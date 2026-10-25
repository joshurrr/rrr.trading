// Focused Asset Analysis browser checks; all API evidence is disposable fixture data.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,'index.html');fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
  const now=new Date().toISOString(),expiry=new Date(Date.now()+3600000).toISOString();
  const row=(symbol,side,rank)=>({exchange:'bybit',symbol:symbol+'USDT',instrument_type:'linear_perpetual',side,rank,timeframe:'1h',momentum_support:'FAVOURS',return_pct:2.3,observed_at:now,expires_at:expiry,state:'CURRENT',source_timestamps:{candles:now},provenance:{source:'saved_paper_cycle',source_version:'paper-cycle-v1',cycle_started_at:now}});
  const rows=[row('BTC','LONG',1),row('ETH','LONG',2),row('SOL','SHORT',1),row('XRP','SHORT',2)];
  const shortlists=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{state:'CURRENT',observed_at:now,expires_at:expiry,purpose:'RESEARCH_RANKING_ONLY',items:rows.filter(r=>r.side===side),provenance:rows[0].provenance}]));
  const asset=r=>({identity:{exchange:r.exchange,instrument_id:r.symbol,instrument_type:r.instrument_type},selection:r,observation_id:r.symbol+'-fixture',technical_join:'EXACT_SELECTION_AND_INSTRUMENT',technical_status:'AVAILABLE',
   technical:Object.fromEntries(['15m','1h','4h'].map(tf=>[tf,{status:'ASSESSED',state:'AVAILABLE',timeframe:tf,trend:r.side==='LONG'?'UP':'DOWN',momentum:r.side==='LONG'?'UP':'DOWN',direction:r.side==='LONG'?'UP':'DOWN',timestamp:now,observed_at:now,expires_at:expiry,indicators:{rsi:r.symbol==='BTCUSDT'?61:39},sides:{[r.side]:{condition:'SUPPORTING',warnings:[]}}}])),
   selection_assessment:{outcome:'WAIT',reasons:['fixture_evidence_only'],entry_timing_caution:[]},luna:{status:'NOT_ASSESSED',scope:'ASSET_SPECIFIC',reason:'No standalone per-asset Luna assessment is retained.'},
   sol:{status:'AVAILABLE',current:{decision:r.side},admission:[],blockers:[],records:[{status:'AVAILABLE',decision:r.side,timestamp:now,ai_status:'OBSERVED',reasoning:r.symbol+' retained reasoning <img src=x onerror=alert(1)>',entry_conditions:'Retained conditions',source:'saved_cycle',evidence_refs:['technical.1h'],request_key:r.symbol+'-request'}]},positions_status:'AVAILABLE',trades_status:'AVAILABLE',positions:[],trades:[{id:r.symbol+'-trade',side:r.side,entered_at:now,closed_at:now,realized_pnl:0,net_pnl:0,exit_reason:'fixture_exit'}]});
  const payload={version:'asset-analysis-read-v1',read_only:true,mode:'paper',availability:'AVAILABLE',served_at:now,shortlists,assets:rows.map(asset),market_context:{state:'CURRENT',source_at:now,expires_at:expiry,assessment:{text:'Saved market assessment, not asset-specific'},news_and_themes:{state:'CURRENT',source_at:now,expires_at:expiry,content:{summary:'Market news',sentiment:'NEUTRAL',themes:[{name:'BTC-only catalyst',description:'Saved targeted theme',affected_markets:['BTC'],implication:'BULLISH',evidence_ids:['A1'],catalysts:[{text:'Saved catalyst'}]}]},provenance:{evidence:[{id:'A1',source:'coindesk',reference:'https://www.coindesk.com/test',published_at:now,state:'CURRENT'}]}}},history:{status:'AVAILABLE',explanation:'Bounded retained observations; departures cannot be established.',items:Array.from({length:14},(_,i)=>({timestamp:now,symbol:'BTCUSDT',side:'LONG',rank:i+1,event:'SHORTLIST_RECORDED'}))}};
  const paper={version:'paper-read-api-v1',mode:'paper',served_at:now,overview:{shortlists,interpretation:payload.market_context}};
  let endpoint='ok',isolated=true;
  await page.route('**/*',route=>{const u=route.request().url();requests.push(u);if(isolated&&new URL(u).pathname==='/radio-navigation.js')return route.fulfill({body:'// Test this document in isolation before the shell smoke check.'});if(u.startsWith('http://127.0.0.1:'))return route.continue();if(u==='https://v4.rrr.trading/v4/asset-analysis')return endpoint==='ok'?route.fulfill({json:payload}):route.fulfill({status:503,body:'unavailable'});if(u==='https://v4.rrr.trading/v4/paper')return endpoint==='fail'?route.fulfill({status:503,body:'unavailable'}):route.fulfill({json:paper});return route.abort();});
  await page.goto('http://127.0.0.1:'+server.address().port+'/asset-analysis/');await page.waitForSelector('.aa-card',{timeout:5000}).catch(async e=>{console.error('Page errors:',errors,'Status:',await page.locator('#asset-analysis-status').allTextContents(),'API requests:',requests.filter(u=>u.includes('/v4/')));throw e;});
  const cards=page.locator('.aa-card');assert.equal(await cards.count(),4);
  assert.equal(await cards.nth(0).locator('.aa-direction').innerText(),'LONG');assert.equal(await cards.nth(0).locator('.aa-rank').innerText(),'Selection rank #1');assert.equal((await cards.nth(0).innerText()).match(/rank #1/g).length,1);
  for(let i=0;i<4;i++){await cards.nth(i).click();assert.match(await page.locator('#asset-analysis-panel-title').innerText(),new RegExp(rows[i].symbol.replace('USDT','')));assert.equal(await page.locator('.aa-panel:not([hidden])').count(),1);assert.equal(await page.locator('.aa-card[aria-expanded="true"]').count(),1);}
  await cards.nth(0).click();await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();assert.match(await page.locator('#aa-detail-panel').innerText(),/61/);
  // Complete unchanged SOL records, all horizons, both sides, zero/precision and stale visibility.
  const oldTechnical=structuredClone(payload.assets[0].technical);
  const recordedAt='2026-10-25T06:15:00Z',expiredAt='2026-10-25T06:30:00Z';
  for(const [i,tf] of ['15m','1h','4h'].entries()){
    const f=payload.assets[0].technical[tf];
    Object.assign(f,{state:'STALE',attribution:i===1?'HISTORICAL':'SOL_DECISION',request_key:'original-request',
      evaluated_at:recordedAt,timestamp:recordedAt,expires_at:expiredAt,
      parameters:{ema_fast:20,ema_slow:50,rsi_period:14,atr_period:14},
      indicators:{close:123.456789012345,ema_fast:123.1,ema_slow:122.2,rsi:61+i,atr:0,atr_pct:0,distance_from_fast_ema_pct:0},
      sides:{LONG:{condition:'SUPPORTS',warnings:['ENTRY_TIMING_CAUTION']},SHORT:{condition:'OPPOSES',warnings:['REVERSAL_WARNING']}}});
    f.recorded_payload={state:'AVAILABLE',timestamps:{timestamp:recordedAt,expires_at:expiredAt},
      evidence:[{source:'fixture',reference:'fixture:candles',observed_at:recordedAt}],
      data:{indicators:f.indicators,LONG:f.sides.LONG,SHORT:f.sides.SHORT,additional_measurement:'<img src=x onerror=alert(1)>'}};
  }
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');
  await cards.nth(0).click();await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();
  const technical=page.locator('.aa-technical-frame');assert.equal(await technical.count(),3);
  for(const [i,heading] of ['15m — Short-Term','1h — Medium-Term','4h — Higher-Timeframe'].entries()){
    const frame=technical.nth(i),text=await frame.innerText();assert.match(text,new RegExp(heading));
    assert.match(text,/123.456789012345/);assert.match(text,/EMA20/);assert.match(text,/EMA50/);assert.match(text,/RSI14/);assert.match(text,/ATR14/);
    assert.match(text,/STALE/);assert.match(text,/25 Oct 2026, 4:15 pm Brisbane/i);assert.match(text,/ENTRY_TIMING_CAUTION/);assert.match(text,/REVERSAL_WARNING/);
    assert.match(text,i===1?/HISTORICAL — Last recorded technical assessment/:/SOL decision evidence/);
    await frame.locator('summary').click();assert.equal(JSON.parse(await frame.locator('pre').innerText()).data.indicators.rsi,61+i);
    assert.match(await frame.locator('pre').innerText(),/fixture:candles/);assert.equal(await frame.locator('img').count(),0);
  }
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  await page.screenshot({path:path.join(__dirname,'.runtime/asset-technical-mobile.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(__dirname,'.runtime/asset-technical-desktop.png'),fullPage:true});
  payload.assets[0].technical=oldTechnical;
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');
  await cards.nth(1).click();await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();assert.match(await page.locator('#aa-detail-panel').innerText(),/39/);assert.doesNotMatch(await page.locator('#aa-detail-panel').innerText(),/61/);
  await page.getByRole('tab',{name:'News & Intelligence',exact:true}).click();assert.match(await page.locator('#aa-detail-panel').innerText(),/NOT_ASSESSED/);assert.doesNotMatch(await page.locator('#aa-detail-panel').innerText(),/BTC-only catalyst/);
  payload.assets[1].luna={status:'PARTIAL',scope:'ASSET_SPECIFIC',coverage:'AVAILABLE',news_state:'AVAILABLE',timestamps:{timestamp:now,expires_at:expiry},discovery:{checked_at:now,last_successful_check:now},assessment:{summary:'Hoodi testnet postponed; no confirmed mainnet delay. ETH price implications uncertain.',implication:'UNKNOWN',uncertainty:['Price implications uncertain'],bullish:[],bearish:[],catalysts:[],risks:[]},news:[{headline:'Glamsterdam on Hoodi Postponed',published_at:'2026-10-22T00:00:00Z',development_status:'OLDER_CONTEXT_UNRESOLVED_STATUS_UNKNOWN',evidence_id:'ETH:N1',provenance:{source:'ethereum_foundation',reference:'https://blog.ethereum.org/en/2026/10/22/glamsterdam-hoodi-delay'}}],provenance:[{source:'ethereum_foundation',reference:'https://blog.ethereum.org/en/2026/10/22/glamsterdam-hoodi-delay',published_at:'2026-10-22T00:00:00Z'}]};
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');await cards.nth(1).click();await page.getByRole('tab',{name:'News & Intelligence',exact:true}).click();
  assert.match(await page.locator('#aa-detail-panel').innerText(),/Glamsterdam on Hoodi Postponed/);assert.match(await page.locator('#aa-detail-panel').innerText(),/22 Oct 2026/);assert.match(await page.locator('#aa-detail-panel').innerText(),/Last successful news check/);assert.match(await page.locator('#aa-detail-panel').innerText(),/no confirmed mainnet delay/);assert.equal(await page.locator('#aa-detail-panel a[href="https://blog.ethereum.org/en/2026/10/22/glamsterdam-hoodi-delay"]').count(),1);
  await page.evaluate(({row,view})=>{const card=document.createElement('div');card.className='candidate-portrait';card.v4Observation={row,view,state:'CURRENT'};const trigger=document.createElement('button');card.append(trigger);document.body.append(card);return window.AssetIntelligence.open('ETH',trigger);},{row:rows[1],view:shortlists.LONG});
  assert.match(await page.locator('#asset-intelligence-dialog').innerText(),/Hoodi testnet postponed/);assert.match(await page.locator('#asset-intelligence-dialog').innerText(),/Last successful news check/);assert.equal(await page.locator('#asset-intelligence-dialog a[href="https://blog.ethereum.org/en/2026/10/22/glamsterdam-hoodi-delay"]').count(),1);await page.getByRole('button',{name:'Close asset intelligence',exact:true}).click();await page.waitForFunction(()=>!document.getElementById('asset-intelligence-dialog').open);
  await cards.nth(0).click();await page.getByRole('tab',{name:'News & Intelligence',exact:true}).click();assert.match(await page.locator('#aa-detail-panel').innerText(),/BTC-only catalyst/);
  payload.assets[0].luna={status:'STALE',scope:'ASSET_SPECIFIC',coverage:'LIMITED_COVERAGE',timestamps:{timestamp:now,expires_at:expiry},assessment:{summary:'Retained BTC assessment <img src=x onerror=alert(1)>',implication:'UNKNOWN',uncertainty:['Limited verified asset news'],bullish:[],bearish:[],catalysts:[],risks:[]},provenance:[{source:'fixture',reference:'https://example.test/btc',published_at:now}]};
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');await cards.nth(0).click();await page.getByRole('tab',{name:'News & Intelligence',exact:true}).click();
  assert.match(await page.locator('#aa-detail-panel').innerText(),/Retained BTC assessment/);assert.match(await page.locator('#aa-detail-panel').innerText(),/STALE/);assert.match(await page.locator('#aa-detail-panel').innerText(),/Limited verified asset news/);assert.equal(await page.locator('#aa-detail-panel img').count(),0);
  await page.getByRole('tab',{name:'SOL Decisions',exact:true}).click();assert.match(await page.locator('#aa-detail-panel').innerText(),/BTCUSDT retained reasoning/);assert.equal(await page.locator('#aa-detail-panel img').count(),0);
  await page.getByRole('tab',{name:'Decision History',exact:true}).click();assert.match(await page.locator('#aa-detail-panel').innerText(),/net P\/L 0 USDT/);assert.equal(await page.locator('.aa-timeline li').count(),4);
  assert.equal(await page.locator('.aa-history-table tbody tr').count(),10);await page.getByRole('button',{name:'Show more retained records'}).click();assert.equal(await page.locator('.aa-history-table tbody tr').count(),14);
  await page.getByRole('tab',{name:'Overview',exact:true}).focus();await page.keyboard.press('ArrowRight');assert.equal(await page.getByRole('tab',{name:'Technical Analysis',exact:true}).getAttribute('aria-selected'),'true');
  for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+width);const dims=await page.evaluate(()=>({cols:getComputedStyle(document.querySelector('#asset-analysis-cards')).gridTemplateColumns.split(' ').length,logos:Array.from(document.querySelectorAll('.aa-logo')).map(e=>e.getBoundingClientRect().width),heights:Array.from(document.querySelectorAll('.aa-card')).map(e=>e.getBoundingClientRect().height),main:document.querySelector('main').getBoundingClientRect().width,header:document.querySelector('[data-site-header] .site-header').getBoundingClientRect().width}));assert(dims.main<=1200);assert(Math.abs(dims.main-dims.header)<1,'header alignment');assert(dims.logos.every(v=>v===44));if(width===1440){assert.equal(dims.cols,4);assert(Math.max(...dims.heights)-Math.min(...dims.heights)<1);}}
  await page.screenshot({path:path.join(__dirname,'.runtime/asset-analysis-mobile-test.png'),fullPage:true});
  await page.setViewportSize({width:1440,height:1000});await cards.nth(0).click();await page.screenshot({path:path.join(__dirname,'.runtime/asset-analysis-desktop-test.png'),fullPage:false});
  await page.keyboard.press('Escape');assert(await page.locator('#asset-analysis-panel').isHidden());
  // Review selections remain visible even when assessment admission leaves the shortlist empty.
  const originalAssets=payload.assets,originalShortlists=payload.shortlists;
  payload.assets=[];
  payload.shortlists=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{...shortlists[side],items:[]}]));
  paper.overview.rankings=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{...shortlists[side],items:shortlists[side].items.map((r,i)=>({...r,selected_for_technical_assessment:i===0}))}]));
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');await page.waitForFunction(()=>document.getElementById('asset-analysis-status').textContent.includes('Saved review selections'));
  assert.equal(await cards.count(),2);assert.match(await cards.nth(0).innerText(),/BTC/);assert.match(await cards.nth(1).innerText(),/SOL/);
  await cards.nth(0).click();await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();assert.doesNotMatch(await page.locator('#aa-detail-panel').innerText(),/61/);
  assert.match(await page.locator('#aa-detail-panel').innerText(),/UNAVAILABLE — No recorded assessment/);
  payload.technical_assessments=[{identity:originalAssets[0].identity,technical:oldTechnical}];
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');
  await cards.nth(0).click();await page.getByRole('tab',{name:'Technical Analysis',exact:true}).click();
  assert.match(await page.locator('#aa-detail-panel').innerText(),/61/);assert.match(await page.locator('#aa-detail-panel').innerText(),/HISTORICAL/);
  delete payload.technical_assessments;
  // ETH review card receives its latest saved news independently of shortlist/technical history.
  const ethRow={...rows[1],rank:6,selected_for_technical_assessment:true};
  paper.overview.rankings.LONG.items=[ethRow];paper.overview.rankings.SHORT.items=[];
  const ethIdentity={exchange:'bybit',instrument_id:'ETHUSDT',instrument_type:'linear_perpetual'};
  const ethLuna={status:'STALE',scope:'ASSET_SPECIFIC',coverage:'AVAILABLE',news_state:'AVAILABLE',
    timestamps:{timestamp:now,expires_at:now},assessment:{summary:'Hoodi postponement is testnet-specific.',implication:'MIXED',
      uncertainty:['Older context; replacement date unknown.'],bullish:[],bearish:[],catalysts:[],risks:[]},
    news:[{headline:'ETH Hoodi testnet announcement',summary:'Saved ETH article summary <img src=x onerror=alert(1)>',
      published_at:now,evidence_id:'ETH:N1',development_status:'OLDER_CONTEXT_UNRESOLVED_STATUS_UNKNOWN',
      provenance:{reference:'https://example.test/eth-hoodi'}}]};
  payload.asset_intelligence=[{identity:ethIdentity,luna:ethLuna}];
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');await page.waitForFunction(()=>document.querySelectorAll('.aa-card').length===1);
  await cards.first().click();await page.getByRole('tab',{name:'News & Intelligence',exact:true}).click();
  let ethText=await page.locator('#aa-detail-panel').innerText();
  assert.match(ethText,/Hoodi postponement is testnet-specific/);assert.match(ethText,/Saved ETH article summary/);
  assert.match(ethText,/STALE/);assert.match(ethText,/ETH:N1/);assert.equal(await page.locator('#aa-detail-panel img').count(),0);
  assert.equal(await page.getByRole('link',{name:'Read source',exact:true}).getAttribute('href'),'https://example.test/eth-hoodi');
  await page.screenshot({path:path.join(__dirname,'.runtime/asset-card-news-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(__dirname,'.runtime/asset-card-news-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
  payload.asset_intelligence=[{identity:{...ethIdentity,exchange:'other'},luna:ethLuna}];
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');await cards.first().click();await page.getByRole('tab',{name:'News & Intelligence',exact:true}).click();
  assert.doesNotMatch(await page.locator('#aa-detail-panel').innerText(),/Hoodi postponement is testnet-specific/);
  delete payload.asset_intelligence;
  paper.overview.rankings.LONG.provenance={cycle_started_at:'2000-01-01T00:00:00Z'};
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');await page.waitForFunction(()=>document.getElementById('asset-analysis-status').textContent.includes('Saved V4.1 evidence loaded'));assert.equal(await cards.count(),0);
  payload.assets=originalAssets;payload.shortlists=originalShortlists;delete paper.overview.rankings;
  endpoint='fallback';await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');await page.waitForFunction(()=>document.getElementById('asset-analysis-status').textContent.includes('detailed evidence endpoint unavailable'));assert.equal(await cards.count(),4);assert.match(await cards.nth(0).innerText(),/UNAVAILABLE/);await cards.nth(0).click();await page.getByRole('tab',{name:'SOL Decisions',exact:true}).click();assert.doesNotMatch(await page.locator('#aa-detail-panel').innerText(),/BTCUSDT retained reasoning/);
  endpoint='fail';await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.getElementById('asset-analysis-cards').getAttribute('aria-busy')==='false');await page.waitForFunction(()=>document.getElementById('asset-analysis-status').textContent.startsWith('UNAVAILABLE'));assert.equal(await cards.count(),0);assert(await page.locator('#asset-analysis-panel').isHidden());
  endpoint='ok';isolated=false;await page.goto('http://127.0.0.1:'+server.address().port+'/asset-analysis/');
  const frame=page.frameLocator('iframe').first();await frame.locator('.aa-card').first().waitFor();await frame.locator('.aa-card').nth(1).click();assert.match(await frame.locator('#asset-analysis-panel-title').innerText(),/ETH/);await frame.getByRole('tab',{name:'Technical Analysis',exact:true}).click();assert.match(await frame.locator('#aa-detail-panel').innerText(),/39/);
  assert(!requests.some(u=>u.includes('/api/v2/intelligence/assets/')),'Legacy intelligence requested');assert.deepEqual(errors,[]);
  console.log('PASS: four-column cards, 44px logos, inline asset-specific panels, technical/news/SOL attribution, retained timeline, zero values, bounded history, XSS safety, keyboard controls, fallback/error states and five responsive widths.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
