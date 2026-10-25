// Local browser fixtures only. Exercise a warm-cache upgrade and the remaining homepage renderers.
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const oldScript='/v4-overview.js?v=20261021.intelligence-complete';
function fixtures(){
  const at=new Date(Date.now()-1000).toISOString(),end=new Date(Date.now()+600000).toISOString();
  const section={state:'CURRENT',source_at:at,observed_at:at,expires_at:end};
  const paper={version:'paper-read-api-v1',mode:'paper',served_at:at,
    wallet:{availability:'AVAILABLE',as_of:at,wallet_balance:'10008',equity:'10010',realized_pnl:'10',unrealized_pnl:'2',entry_fees_paid:'0',exit_fees_paid:'2',valuation_expires_at:end,
      field_availability:Object.fromEntries(['wallet_balance','equity','realized_pnl','unrealized_pnl','entry_fees_paid','exit_fees_paid'].map(k=>[k,'AVAILABLE']))},
    open_positions:{availability:'AVAILABLE',items:[{symbol:'BTCUSDT',exchange:'bybit',side:'LONG',availability:'AVAILABLE',entry_price:'100',current_mark:'102',unrealized_pnl:'2',leverage:'1',entered_at:at,mark_observed_at:at,mark_expires_at:end}]},
    completed_trades:{availability:'AVAILABLE',as_of:at,items:[{id:'fixture-close',symbol:'ETHUSDT',side:'SHORT',entered_at:new Date(Date.now()-3600000).toISOString(),closed_at:at,entry_price:'110',exit_price:'100',realized_pnl:'10',net_pnl:'8',exit_reason:'PROTECTIVE_STOP'}]},
    overview:{version:'paper-overview-v1',purpose:'PUBLIC_SAVED_OBSERVATIONS_ONLY',
      breadth:{...section,health:'AVAILABLE',values:{rising_24h_pct:40,falling_24h_pct:60,assets_included:50,median_change_24h_pct:-1}},
      fear_greed:{...section,values:{value:25,classification:'Fear'}},
      sentiment:{...section,context_state:'CURRENT',status:'USABLE',market_direction:'DOWN'},
      interpretation:{...section,historical:false,health:'AVAILABLE',validation:'SAVED_SCHEMA_AND_ORIGINAL_EVIDENCE_VALIDATED',market_direction:'DOWN',assessment:{text:'Local test saved assessment'},provenance:{evidence:[]}},
      paper_trading:{...section,status:'OK',monitoring:{status:'OK',unmonitored:[]}}}};
  const universe={schema_version:1,status:'ok',universe_version:'local-test',generated_at:at,valid_until:end,
    assets:['BTC','ETH','SOL','XRP','ADA','DOGE','AVAX','LINK','DOT','UNI'].map((symbol,i)=>({symbol,pair:symbol+'/USDT:USDT',rank:i+1,opportunity_score:50,reason:'Local test ranking'}))};
  return {paper,universe};
}
(async()=>{
  const served=[];
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');let body;
    if(url.pathname==='/cache-seed'){body=`<script src="${oldScript}"></script>`;}
    else if(req.url===oldScript){served.push(req.url);body='window.cachedPreCleanupScript=true;';}
    else if(url.pathname==='/radio-navigation.js'){body='';}
    else{
      const file=path.resolve(__dirname,'.'+url.pathname.replace(/\/$/,'/index.html'));
      if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();
      try{body=fs.readFileSync(file);}catch{return res.writeHead(404).end();}
      if(url.pathname==='/v4-overview.js')served.push(req.url);
    }
    res.setHeader('Cache-Control',url.pathname==='/v4-overview.js'?'public,max-age=14400':'no-store');
    res.setHeader('Content-Type',url.pathname.endsWith('.js')?'application/javascript':url.pathname.endsWith('.css')?'text/css':'text/html');res.end(body);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const page=await browser.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(e.stack||e.message));
    // Routing disables Chromium's HTTP cache, so replace only fetch in this local test.
    await page.addInitScript(data=>{
      window.testFeeds=data;window.testRequests=[];
      window.fetch=async(url,options={})=>{
        window.testRequests.push({url:String(url),method:options.method||'GET'});
        if(String(url)==='https://v4.rrr.trading/v4/paper')return new Response(JSON.stringify(window.testFeeds.paper),{status:window.failPaper?503:200});
        if(String(url)==='https://api.rrr.trading/api/trading-universe')return new Response(JSON.stringify(window.testFeeds.universe),{status:200});
        return new Response('{}',{status:503});
      };
    },fixtures());
    const base='http://127.0.0.1:'+server.address().port;
    await page.goto(base+'/cache-seed');assert.equal(await page.evaluate(()=>cachedPreCleanupScript),true);
    await page.goto(base+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>document.querySelector('#v4-overview').getAttribute('aria-busy')==='false');
    assert.equal(await page.evaluate(()=>window.cachedPreCleanupScript),undefined,'homepage must not reuse the pre-cleanup cached asset');
    assert.equal(served.length,2);assert.notEqual(served[0],served[1]);
    assert.equal(await page.locator('#home-equity').innerText(),'10,010.00 USDT');
    assert.equal(await page.locator('#home-total-pnl').innerText(),'+10.00 USDT');
    assert.equal(await page.locator('#home-realized-pnl').innerText(),'+10.00 USDT');
    assert.equal(await page.locator('.home-position').count(),1);
    assert.match(await page.locator('#home-closed-trades-body').innerText(),/ETHUSDT[\s\S]*10.00 USDT[\s\S]*Protective Stop/);
    assert.equal(await page.locator('#market-condition-headline').innerText(),'BEARISH');
    assert.match(await page.locator('[data-v4-section="breadth"] .v4-value').innerText(),/40% rising.*60% falling/);
    assert.match(await page.locator('[data-v4-section="fear_greed"] .v4-value').innerText(),/25 \/ 100/);
    assert.equal(await page.locator('#header-assets .header-asset').count(),10);
    for(const selector of ['#home-macro-title','#home-theme-list','#v4-overview-status','main > p.shell > a[href="/asset-explorer/"]'])assert.equal(await page.locator(selector).count(),0);
    assert.equal(await page.evaluate(()=>testRequests.filter(r=>r.url==='https://v4.rrr.trading/v4/paper').length),1,'all V4 panels share the existing request');
    for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));}
    await page.evaluate(async()=>{window.failPaper=true;await refreshV4Overview();});
    assert.equal(await page.locator('#home-equity').innerText(),'10,010.00 USDT · STALE');
    assert.equal(await page.locator('.home-position').count(),1);
    assert.equal(await page.locator('#home-positions-state').innerText(),'STALE');
    assert.match(await page.locator('#home-position-time').innerText(),/STALE.*Retained snapshot.*Source:/);
    assert.match(await page.locator('#home-closed-trades-state').innerText(),/STALE/);
    assert.equal(await page.evaluate(()=>v4FinancialDiagnostics.http_status),503);
    assert.doesNotMatch(await page.locator('#home-closed-trades-body').innerText(),/Loading/);
    assert.equal(await page.locator('#header-assets .header-asset').count(),10,'independent Top 10 survives V4 feed failure');
    await page.evaluate(()=>{window.realNow=Date.now;Date.now=()=>realNow()+120001;});
    await page.waitForTimeout(1100);
    assert.equal(await page.locator('#home-equity').innerText(),'Unavailable','retention expires even without another request');
    assert.equal(await page.locator('#home-position-list').innerText(),'Positions Unavailable');
    assert.match(await page.locator('#home-position-time').innerText(),/Snapshot unavailable.*API_UNAVAILABLE/);
    await page.evaluate(()=>{Date.now=realNow;});
    await page.evaluate(async()=>{window.failPaper=false;await refreshV4Overview();});
    assert.equal(await page.locator('#home-equity').innerText(),'10,010.00 USDT');
    await page.evaluate(async()=>{window.currentServed=testFeeds.paper.served_at;testFeeds.paper.served_at=new Date(Date.parse(currentServed)-1000).toISOString();await refreshV4Overview();});
    assert.equal(await page.evaluate(()=>v4FinancialDiagnostics.reason),'older_snapshot');
    assert.match(await page.locator('#home-equity').innerText(),/10,010.00 USDT.*STALE/);
    await page.evaluate(async()=>{testFeeds.paper.served_at=currentServed;await refreshV4Overview();});
    await page.evaluate(async()=>{window.goodPaper=structuredClone(testFeeds.paper);delete testFeeds.paper.completed_trades;await refreshV4Overview();});
    assert.match(await page.locator('#home-equity').innerText(),/10,010.00 USDT.*STALE/);
    assert.equal(await page.evaluate(()=>v4FinancialDiagnostics.state),'VALIDATION_FAILED');
    await page.evaluate(async()=>{testFeeds.paper=structuredClone(goodPaper);await refreshV4Overview();});
    assert.equal(await page.locator('#home-equity').innerText(),'10,010.00 USDT');
    await page.evaluate(async()=>{testFeeds.paper.wallet.writer_lock_present=true;await refreshV4Overview();});
    assert.equal(await page.locator('#home-equity').innerText(),'10,010.00 USDT');
    assert.equal(await page.evaluate(()=>v4FinancialDiagnostics.writer_lock_present),true);
    assert.equal(await page.evaluate(()=>v4FinancialDiagnostics.display),'CURRENT');
    await page.evaluate(async()=>{delete testFeeds.paper.wallet.writer_lock_present;await refreshV4Overview();});
    assert.equal(await page.locator('#home-equity').innerText(),'10,010.00 USDT');
    await page.evaluate(async()=>{testFeeds.paper.wallet.valuation_expires_at=new Date(Date.now()-1).toISOString();await refreshV4Overview();});
    assert.equal(await page.locator('#home-equity').innerText(),'Unavailable','freshness safeguards remain active');
    assert.equal(await page.locator('#home-wallet-balance').innerText(),'10,008.00 USDT','settled balance does not expire with marks');
    assert.equal(await page.locator('#home-realized-pnl').innerText(),'+10.00 USDT','recorded history does not expire with marks');
    assert.equal(await page.locator('#home-position-count').innerText(),'1','position inventory does not expire with marks');
    assert.equal(await page.locator('#home-positions-state').innerText(),'STALE VALUATION');
    assert.doesNotMatch(await page.locator('#home-closed-trades-state').innerText(),/STALE/);
    await page.evaluate(async()=>{testFeeds.paper.wallet.availability='STALE';testFeeds.paper.open_positions.availability='STALE';testFeeds.paper.open_positions.inventory_availability='AVAILABLE';testFeeds.paper.open_positions.items[0].availability='STALE';await refreshV4Overview();});
    assert.equal(await page.locator('#home-position-count').innerText(),'1','fresh inventory survives a stale valuation summary');
    assert.equal(await page.locator('#home-wallet-balance').innerText(),'10,008.00 USDT');
    assert(await page.evaluate(()=>testRequests.every(r=>r.method==='GET')));assert.deepEqual(errors,[]);
    console.log('PASS homepage cache upgrade, performance, equity, positions, closed trades, intelligence, Top 10, removed sections, mobile/desktop, API failure/recovery and expiry.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
