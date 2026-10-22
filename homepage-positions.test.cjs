// Focused local fixtures: no live accounts or trading actions.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const fixture=()=>{
  const at=new Date().toISOString(),end=new Date(Date.now()+600000).toISOString();
  const position=(symbol,side,pnl)=>({symbol,side,exchange:'bybit',availability:'AVAILABLE',entry_price:'100',current_mark:'102',leverage:'2',unrealized_pnl:pnl,entered_at:new Date(Date.now()-3600000).toISOString(),mark_observed_at:at,mark_expires_at:end,last_known_mark:'101',last_known_unrealized_pnl:'1'});
  return {version:'paper-read-api-v1',mode:'paper',served_at:at,
    overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY'},
    open_positions:{availability:'AVAILABLE',items:[position('BTCUSDT','SHORT','2.50'),position('ETHUSDT','LONG','-1.25')]},
    wallet:{availability:'AVAILABLE',as_of:at,wallet_balance:'10102.01',equity:'10123.87',realized_pnl:'107.62',unrealized_pnl:'21.86',entry_fees_paid:'2.40',exit_fees_paid:'3.21',
      field_availability:{wallet_balance:'AVAILABLE',equity:'AVAILABLE',realized_pnl:'AVAILABLE',unrealized_pnl:'AVAILABLE',entry_fees_paid:'AVAILABLE',exit_fees_paid:'AVAILABLE'},
      valuation_expires_at:end,last_known:{equity:'10120.00',unrealized_pnl:'1.00'}},
    completed_trades:{availability:'AVAILABLE',as_of:at,items:[
      {id:'older',closed_at:new Date(Date.now()-25*3600000).toISOString(),realized_pnl:'7.62'},
      {id:'recent-a',closed_at:new Date(Date.now()-2*3600000).toISOString(),realized_pnl:'70.00'},
      {id:'recent-b',closed_at:new Date(Date.now()-3600000).toISOString(),realized_pnl:'30.00'}]},
    latest_cycle:{availability:'UNAVAILABLE'},sentiment:{availability:'UNAVAILABLE'}};
};
(async()=>{
  const server=http.createServer((req,res)=>{const f=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));if(!f.startsWith(__dirname+path.sep))return res.writeHead(403).end();fs.readFile(f,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',f.endsWith('.js')?'application/javascript':f.endsWith('.css')?'text/css':'text/html');res.end(b);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage(),errors=[],requests=[];let data=fixture(),fail=false;
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/radio-navigation.js*',r=>r.fulfill({body:''}));
    await page.route('https://stream.radiorrr.com/**',r=>r.abort());
    await page.route('https://api.rrr.trading/**',r=>r.fulfill({status:503}));
    await page.route('https://assets.coincap.io/**',r=>r.abort());
    await page.route('https://v4.rrr.trading/**',r=>{requests.push(r.request().url());assert.equal(r.request().method(),'GET');assert.equal(new URL(r.request().url()).pathname,'/v4/paper');return fail?r.fulfill({status:503}):r.fulfill({json:data});});
    await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#v4-overview').getAttribute('aria-busy')==='false');
    assert.equal(requests.length,1,'positions reuse the overview fetch');
    const demo=await browser.newPage();
    await demo.route('https://rrr.trading/**',r=>r.fulfill({status:200,body:''}));
    await demo.route('**/v4/paper',r=>r.fulfill({json:data}));
    await demo.goto('http://127.0.0.1:'+server.address().port+'/v4/',{waitUntil:'domcontentloaded'});
    await demo.waitForFunction(()=>document.querySelector('#main')?.getAttribute('aria-busy')==='false');
    for(const [homeId,demoId] of [['home-wallet-balance','wallet-balance'],['home-equity','wallet-equity'],['home-wallet-realized','wallet-realized'],['home-open-pnl','wallet-unrealized']]) {
      await page.waitForFunction(([home,dash])=>document.getElementById(home)?.textContent!=='Unavailable'&&document.getElementById(dash)?.textContent!=='Unavailable',[homeId,demoId]);
      assert.equal(await page.locator('#'+homeId).innerText(),await demo.locator('#'+demoId).innerText(),'homepage and V4 dashboard agree on '+homeId+' from the same snapshot');
    }
    await demo.close();
    assert.equal(await page.locator('.home-intro h1').textContent(),'RRR.TRADING');
    assert.equal(await page.locator('.home-intro h2').innerText(),'Market Intelligence & Automated Trading');
    assert.equal(await page.locator('.home-intro-features li').count(),4);
    assert.match(await page.locator('.home-intro-features').innerText(),/Live market research and analysis[\s\S]*Dynamic trading opportunities[\s\S]*Automated trading decisions[\s\S]*Transparent performance tracking/);
    assert.equal(await page.locator('[data-site-header] .site-header').count(),1);
    assert.equal(await page.locator('#radio-audio').count(),1);
    assert.equal(await page.locator('.operating-modes .mode-button').count(),4);
    assert.equal(await page.locator('.home-intro nav a').nth(0).getAttribute('href'),'/analysis/');
    assert.equal(await page.locator('.home-intro nav a').nth(1).getAttribute('href'),'https://v4.rrr.trading/');
    fs.mkdirSync('.runtime/homepage-positions',{recursive:true});
    await page.setViewportSize({width:1440,height:1000});
    assert.equal(await page.locator('.home-direction-card, .home-intelligence-indicators > article:not([data-v4-section="sentiment"])').count(),4,'four compact intelligence cards');
    assert.equal(await page.locator('#home-intelligence-sources').count(),1,'validated source disclosure remains unique');
    assert.equal(await page.locator('.home-macro-conditions-card .v4-state').innerText(),'UNAVAILABLE');
    assert.equal(await page.locator('#home-saved-assessment .text-link').getAttribute('href'),'/analysis/');
    assert.equal(await page.locator('.home-intelligence-links a').nth(0).getAttribute('href'),'/research-news/');
    assert.equal(await page.locator('.home-intelligence-links a').nth(1).getAttribute('href'),'/market-conditions/');
    assert.equal(await page.locator('#home-theme-list > p').innerText(),'Market themes unavailable.');
    assert.equal(await page.locator('.home-intelligence-cards').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),4,'desktop intelligence grid');
    assert(await page.locator('.home-intelligence-card, .home-intelligence-indicators > article:not([data-v4-section="sentiment"])').evaluateAll(ns=>ns.every(n=>n.getBoundingClientRect().height<=200)),'intelligence cards remain compact and nested cash-index details do not cause oversized panels');
    fs.mkdirSync('.runtime/homepage-intelligence',{recursive:true});
    await page.locator('.home-market-overview').screenshot({path:'.runtime/homepage-intelligence/market-desktop.png'});
    await page.locator('section[aria-labelledby="home-macro-title"]').screenshot({path:'.runtime/homepage-intelligence/themes-desktop.png'});
    await page.locator('.home-market-research-details > summary').click();
    assert(await page.locator('#home-intelligence-sources').isVisible(),'validated sources stay available in expandable research');
    await page.locator('#home-intelligence-sources > summary').click();
    assert.equal(await page.locator('#home-intelligence-sources').getAttribute('open'),'','source citation disclosure expands');
    await page.locator('#home-intelligence-sources > summary').click();
    await page.locator('.home-market-research-details > summary').click();
    assert(await page.locator('[data-site-header] .site-header').evaluate(n=>n.getBoundingClientRect().height<=130),'desktop promo header stays compact');
    assert(await page.locator('[data-site-header] .operating-modes').evaluate(n=>n.getBoundingClientRect().height<=56),'desktop navigation stays compact');
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'.runtime/homepage-positions/hero-desktop.png'});
    const cards=page.locator('.home-position');
    assert.equal(await cards.count(),2);
    assert.equal(await page.locator('#home-position-list').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),2,'two positions use two desktop columns');
    const twoWidths=await cards.evaluateAll(ns=>ns.map(n=>n.getBoundingClientRect().width));
    assert(Math.abs(twoWidths[0]-twoWidths[1])<2,'two desktop position cards are evenly sized');
    data.open_positions.items.pop();await page.evaluate(()=>refreshV4Overview());
    assert.equal(await cards.count(),1,'single position fixture renders');
    assert.equal(await page.locator('#home-position-list').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),1,'single position uses one bounded column');
    assert(await cards.first().evaluate(n=>n.getBoundingClientRect().width<=642),'single desktop position card has a sensible maximum width');
    data=fixture();await page.evaluate(()=>refreshV4Overview());
    assert.equal(await cards.count(),2,'two-position fixture restores');
    assert.equal(await page.locator('#home-position-count').innerText(),'2');
    assert.equal(await page.locator('#home-position-pnl').innerText(),'21.86 USDT');
    assert.equal(await page.locator('#home-equity').innerText(),'10,123.87 USDT');
    assert.match(await page.locator('#home-equity-note').innerText(),/Valuation saved .*AEST/);
    assert.equal(await page.locator('#home-wallet-balance').innerText(),'10,102.01 USDT');
    assert.equal(await page.locator('#home-wallet-realized').innerText(),'107.62 USDT');
    assert.equal(await page.locator('#home-total-pnl').innerText(),'+123.87 USDT','overall P/L nets realised/unrealised against fees and reconciles to equity');
    assert.equal(await page.locator('#home-total-pnl').getAttribute('data-tone'),'up');
    assert.equal(await page.locator('#home-realized-pnl').innerText(),'+100.00 USDT','rolling sum excludes the trade older than 24 hours');
    assert.equal(await page.locator('#home-realized-pnl').getAttribute('data-state'),'available');
    data=fixture();data.completed_trades.items.pop();await page.evaluate(()=>refreshV4Overview());
    assert.equal(await page.locator('#home-total-pnl').innerText(),'+123.87 USDT','unavailable history does not block the wallet total');
    assert.equal(await page.locator('#home-realized-pnl').innerText(),'Unavailable','incomplete ledger history cannot claim a complete 24-hour total');
    data=fixture();data.wallet.field_availability.exit_fees_paid='UNAVAILABLE';await page.evaluate(()=>refreshV4Overview());
    assert.equal(await page.locator('#home-total-pnl').innerText(),'Unavailable','missing fee evidence prevents a fabricated net all-time total');
    assert.equal(await page.locator('#home-realized-pnl').innerText(),'+100.00 USDT','missing fee evidence does not block history-backed realised P/L');
    data=fixture();data.wallet.equity='10129.00';await page.evaluate(()=>refreshV4Overview());
    assert.equal(await page.locator('#home-total-pnl').innerText(),'Unavailable','inconsistent wallet equity fails the P/L reconciliation check');
    assert.equal(await page.locator('#home-realized-pnl').innerText(),'+100.00 USDT','equity mismatch does not block complete realised history');
    data=fixture();await page.evaluate(()=>refreshV4Overview());
    assert.equal(await cards.first().locator('.home-position-profit').getAttribute('data-pnl'),'profit','profitable SHORT is green');
    assert.equal(await cards.nth(1).locator('.home-position-profit').getAttribute('data-pnl'),'loss','losing LONG is red');
    assert.match(await cards.first().innerText(),/UNKNOWN/);
    assert.match(await cards.first().innerText(),/2×/);assert.match(await cards.first().innerText(),/1h 0m/);
    assert.match(await page.locator('#home-position-time').innerText(),/AEST/);
    await page.waitForFunction(()=>document.querySelector('#homepage-trade-history')?.dataset.coverage==='unavailable');
    assert.equal(await page.locator('#live-candidate-progress .performance-metrics').isVisible(),false,'unavailable activity collapses the statistics strip');
    assert.match(await page.locator('#homepage-trade-history .feed-note').innerText(),/activity unavailable/);
    assert(await page.locator('.home-equity-chart').evaluate(n=>n.getBoundingClientRect().height<125),'unavailable equity remains compact');
    await page.evaluate(()=>{
      window.RRRGeneration=undefined;
      const started_at=new Date(Date.now()-3600000).toISOString(), observed_at=new Date().toISOString();
      const history=[{id:901,pair:'BTC/USDT',direction:'LONG',open_date:started_at,close_date:observed_at,open_rate:100,close_rate:101,profit_abs:1,exit_reason:'roi'}];
      const reports=Object.fromEntries(['short','medium','long'].map((tf,i)=>[tf,{available:true,run_id:'fixture-run',started_at,observed_at,history:i===0?history:[],open_trades:[],portfolio:{closed_trades:i===0?1:0}}]));
      window.dispatchEvent(new CustomEvent('rrr-order-evidence',{detail:{metadata:{mode:'PAPER',stale:false,last_run:observed_at,run_id:'fixture-run',started_at},reports}}));
    });
    assert.equal(await page.locator('#homepage-trade-history').getAttribute('data-coverage'),'available','validated report fixture restores activity layout');
    assert.equal(await page.locator('.trade-history-row').count(),1,'validated closed event renders through existing renderer');
    assert(await page.locator('#live-candidate-progress .performance-metrics').isVisible(),'activity statistics return with validated reports');
    await page.evaluate(()=>{
      const now=Date.now(),closed=new Date(now-3600000).toISOString(),opened=new Date(now-7200000).toISOString();
      const status=Object.fromEntries([['short','15m'],['medium','1h'],['long','4h']].map(([key,timeframe],i)=>[key,{
        ok:true,bot:{mode:'PAPER',timeframe,stake_currency:'USDT'},generated_at:now/1000,status_observed_at:now/1000,open_trades:[],
        history:[{id:901+i,pair:'BTC/USDT',open_date:opened,close_date:closed,profit_abs:1}],portfolio:{closed_trades:1}
      }]));
      window.ActivityPerformance.render(status);
    });
    assert.equal(await page.locator('#home-realized-pnl').innerText(),'+100.00 USDT','secondary legacy performance renderer cannot overwrite the authoritative V4 ledger value');
    await page.evaluate(()=>{
      const started_at=new Date(Date.now()-3600000).toISOString(), observed_at=new Date().toISOString();
      const reports=Object.fromEntries(['short','medium','long'].map(tf=>[tf,{available:true,run_id:'fixture-empty',started_at,observed_at,history:[],open_trades:[],portfolio:{closed_trades:0}}]));
      window.dispatchEvent(new CustomEvent('rrr-order-evidence',{detail:{metadata:{mode:'PAPER',stale:false,last_run:observed_at,run_id:'fixture-empty',started_at},reports}}));
    });
    assert.equal(await page.locator('#homepage-trade-history').getAttribute('data-coverage'),'empty','verified zero-activity period remains distinct from unavailable');
    assert(await page.locator('#live-candidate-progress .performance-metrics').isVisible(),'verified zero activity retains statistics');
    data=fixture();data.open_positions.items.push({...data.open_positions.items[0],symbol:'SOLUSDT'});await page.evaluate(()=>refreshV4Overview());
    assert.equal(await cards.count(),3,'three genuine fixture positions render');
    assert.equal(await page.locator('#home-position-list').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length),3,'desktop positions use three columns');
    data.open_positions.items.pop();await page.evaluate(()=>refreshV4Overview());
    data.open_positions.items[0].protection={status:'PROTECTED',original_stop:'110',active_stop:'95',estimated_stop_pnl_usdt:'10',
      latest_decision:'PROTECT',review_result:'STOP_ADJUSTED',last_successful_review_at:data.served_at};
    data.open_positions.items[1].protection={status:'ORIGINAL STOP',original_stop:'95',active_stop:'95',estimated_stop_pnl_usdt:'-10',
      latest_decision:'PROTECT',review_result:'BLOCKED',last_successful_review_at:data.served_at};
    await page.evaluate(()=>refreshV4Overview());
    assert.match(await cards.first().innerText(),/PROTECTED/);
    assert.match(await cards.first().innerText(),/Luna PROTECT.*applied/);
    assert.match(await cards.nth(1).innerText(),/proposal rejected/);
    await page.addStyleTag({content:'#home #home-demo-positions .home-protection-details{display:block!important}'});
    await cards.first().locator('.home-protection-details summary').click();
    assert.match(await cards.first().innerText(),/10.00 USDT/);
    assert.match(await cards.first().innerText(),/before fees and slippage/);
    assert.match(await cards.first().innerText(),/110/);
    for(const width of [1440,768,390,320]){
      await page.setViewportSize({width,height:1000});
      const positionColumns=await page.locator('#home-position-list').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length);
      assert.equal(positionColumns,width<=520?1:2,'two position cards use responsive columns at '+width+'px');
      const intelligenceColumns=await page.locator('.home-intelligence-cards').evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length);
      assert.equal(intelligenceColumns,width<=520?2:width<=600?1:width<=950?2:4,'intelligence grid at '+width+'px');
      const overflow=await page.evaluate(()=>({page:document.documentElement.scrollWidth,items:Array.from(document.querySelectorAll('body *')).map(n=>({tag:n.tagName,id:n.id,className:typeof n.className==='string'?n.className:'',right:Math.round(n.getBoundingClientRect().right)})).filter(n=>n.right>innerWidth+1).slice(0,8)}));
      assert(overflow.page<=width,'page overflow '+width+': '+JSON.stringify(overflow));
      assert(await cards.first().locator('.home-position-monogram').isVisible(),'logo failure fallback');
      if(width===390){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'.runtime/homepage-positions/hero-mobile.png'});}
      if(width===390){await page.locator('.home-market-overview').screenshot({path:'.runtime/homepage-intelligence/market-mobile.png'});await page.locator('section[aria-labelledby="home-macro-title"]').screenshot({path:'.runtime/homepage-intelligence/themes-mobile.png'});}
      fs.mkdirSync('.runtime/homepage-positions',{recursive:true});
      await page.locator('#home-demo-positions').screenshot({path:'.runtime/homepage-positions/'+width+'.png'});
    }
    const refresh=async()=>page.evaluate(()=>refreshV4Overview());
    data=fixture();data.open_positions.items[0].protection={status:'ORIGINAL STOP',latest_decision:'PROTECT',review_result:'RECOMMENDATION_ONLY'};
    await refresh();assert.match(await cards.first().innerText(),/recommendation only/);assert.doesNotMatch(await cards.first().innerText(),/PROTECTED/);
    await cards.first().locator('.home-protection-details summary').click();assert.match(await cards.first().innerText(),/UNKNOWN/);
    data=fixture();data.open_positions.items=[];data.wallet.unrealized_pnl='0';await refresh();
    assert.equal(await page.locator('#home-position-count').innerText(),'0');assert.match(await page.locator('#home-position-list').innerText(),/^No Open Demo Positions$/);assert.equal(await page.locator('#home-position-pnl').innerText(),'0.00 USDT');
    data.open_positions.availability='STALE';await refresh();assert.doesNotMatch(await page.locator('#home-position-list').innerText(),/No Open Demo Positions/);assert.match(await page.locator('#home-position-list').innerText(),/Current positions unknown/);
    data=fixture();data.open_positions={availability:'UNAVAILABLE'};await refresh();assert.equal(await page.locator('#home-position-list').innerText(),'Positions Unavailable');
    data=fixture();data.open_positions.items={};await refresh();assert.equal(await cards.count(),0);assert.equal(await page.locator('#home-position-count').innerText(),'Unavailable');
    data=fixture();data.wallet.valuation_expires_at=new Date(Date.now()-1).toISOString();await refresh();
    assert.equal(await page.locator('#home-equity').innerText(),'Unavailable');assert.match(await page.locator('#home-equity-note').innerText(),/STALE · Last known: 10,120.00 USDT/);
    assert.equal(await page.locator('#home-wallet-balance').innerText(),'10,102.01 USDT','ledger balance remains separately available');
    data=fixture();data.open_positions.items[0].mark_expires_at=new Date(Date.now()-1).toISOString();await refresh();
    assert.equal(await page.locator('#home-positions-state').innerText(),'STALE');assert.equal(await page.locator('#home-position-pnl').innerText(),'Unavailable');assert.match(await cards.first().innerText(),/Last known: 101/);
    data=fixture();data.wallet.field_availability.unrealized_pnl='STALE';await refresh();assert.equal(await page.locator('#home-position-pnl').innerText(),'Unavailable');assert.match(await page.locator('#home-position-valuation').innerText(),/STALE/);
    data=fixture();data.wallet.unrealized_pnl=false;data.open_positions.items[0].unrealized_pnl='';data.open_positions.items[0].entered_at=null;await refresh();assert.equal(await page.locator('#home-position-pnl').innerText(),'Unavailable');assert.equal(await cards.first().locator('.home-position-profit dd').innerText(),'Unavailable');
    data=fixture();data.open_positions.items[0].symbol='<img src=x onerror="window.BAD=1">';await refresh();assert.equal(await page.evaluate(()=>window.BAD),undefined);assert.match(await cards.first().locator('h3').innerText(),/<img/);
    for(const scope of ['root','nested']){data=fixture();if(scope==='root')data.mode='live';else data.open_positions.items[0].mode='live';await refresh();assert.equal(await page.locator('#home-position-list').innerText(),'Positions Unavailable');}
    data=fixture();data.open_positions.items[0].mark_expires_at=new Date(Date.now()+1100).toISOString();await refresh();await page.waitForFunction(()=>document.querySelector('#home-positions-state').textContent==='STALE');
    fail=true;await refresh();assert.equal(await page.locator('#home-position-list').innerText(),'Positions Unavailable');assert.equal(await cards.count(),0);
    assert.equal(await page.locator('#home-equity').innerText(),'Unavailable');assert.equal(await page.locator('#home-wallet-balance').innerText(),'Unavailable');
    assert.equal(await page.locator('#home-total-pnl').innerText(),'Unavailable');assert.equal(await page.locator('#home-realized-pnl').innerText(),'Unavailable');
    assert.deepEqual(errors,[]);console.log('PASS: same-snapshot V4/home wallet agreement, fee-aware total P/L, ledger-verified rolling 24h P/L, incomplete/missing/stale guards, no legacy overwrite, and four responsive widths.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
