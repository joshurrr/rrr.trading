"use strict";
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('@playwright/test');
(async()=>{
 const server=http.createServer((req,res)=>{const file=path.resolve(__dirname,'.'+new URL(req.url,'http://localhost').pathname);if(!file.startsWith(__dirname+path.sep))return res.writeHead(403).end();const target=fs.existsSync(file)&&fs.statSync(file).isDirectory()?path.join(file,'index.html'):file;fs.readFile(target,(err,body)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',target.endsWith('.js')?'application/javascript':target.endsWith('.css')?'text/css':'text/html');res.end(body);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true,channel:'msedge'});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));
  const now=new Date().toISOString(),end=new Date(Date.now()+120000).toISOString();
  const identity={exchange:'bybit',instrument_id:'BTCUSDT',instrument_type:'linear_perpetual',quote_currency:'USDT',settle_currency:'USDT'};
  const quote={...identity,price:103.25,change_24h_pct:0,ticker_observed_at:now,ticker_expires_at:end,ticker_health:'AVAILABLE',evidence:{ticker:{source:'bybit',reference:'https://api.bybit.com/v5/market/tickers?category=linear',observed_at:now}}};
  const input={as_of:now,snapshot:{identity,evidence:{'market.ticker':{state:'AVAILABLE',data:{price:103.25},timestamps:{timestamp:now,observed_at:now,expires_at:end},evidence:[quote.evidence.ticker]},'technical.5m':{state:'AVAILABLE',data:{return_pct:0}},'news.themes':{state:'MISSING',data:null}}},effective_freshness:{'market.ticker':'AVAILABLE'},entry_context:{equity:0},order_constraints:{max_leverage:2}};
  const row={exchange:'bybit',symbol:'BTCUSDT',instrument_type:'linear_perpetual',side:'LONG',rank:1,state:'CURRENT',observed_at:now,expires_at:end,provenance:{}};
  const shortlists=Object.fromEntries(['LONG','SHORT'].map(side=>[side,{state:'CURRENT',observed_at:now,expires_at:end,items:side==='LONG'?[row]:[]} ]));
  const universe={state:'CURRENT',observed_at:now,expires_at:end,pool_asset_count:1,assets:[{exchange:'bybit',symbol:'BTCUSDT',pair:'BTCUSDT/USDT:USDT'}]};
  const asset={identity,selection:row,technical:{},luna:{status:'NOT_ASSESSED',scope:'ASSET_SPECIFIC'},sol:{records:[{status:'AVAILABLE',decision:'NO_TRADE',timestamp:now,source:'saved_cycle',request_key:'fixture-original',reasoning:'Fixture',decision_input:input}]},positions:[],trades:[]};
  const payload={version:'asset-analysis-read-v1',mode:'paper',read_only:true,availability:'AVAILABLE',served_at:now,shortlists,trading_universe:universe,assets:[asset],canonical_observations:{market_context:{market:{assets:{BTCUSDT:quote}}}},history:{items:[]}};
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.pathname==='/radio-navigation.js')return route.fulfill({body:'// Isolated Analysis fixture; shell is covered separately.'});if(url.hostname==='127.0.0.1')return route.continue();if(url.hostname==='v4.rrr.trading'){
    if(url.pathname==='/v4/asset-analysis')return route.fulfill({json:payload});
    if(url.pathname==='/v4/paper')return route.fulfill({json:{version:'paper-read-api-v1',mode:'paper',served_at:now,overview:{shortlists,trading_universe:universe},open_positions:{availability:'AVAILABLE',items:[]}}});
    if(url.pathname==='/v4/intelligence'){await new Promise(r=>setTimeout(r,200));return route.fulfill({json:{version:'theme-intelligence-read-v1',mode:'paper',read_only:true,scope:'ASSET:BTC',availability:'AVAILABLE',themes:[]}});}
   }external.push(url.toString());return route.abort();
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/asset-analysis/`);await page.locator('.aa-card').first().click({timeout:5000}).catch(async e=>{console.error('Fixture location:',page.url(),await page.title(),(await page.locator('body').innerText()).slice(0,200));console.error('Fixture state:',await page.locator('#asset-analysis-status').allTextContents(),errors,external);throw e;});
  const panel=page.locator('#aa-detail-panel');await panel.getByText('103.25 USDT',{exact:true}).waitFor();
  assert(!external.some(u=>u.includes('/tickers')),'Overview must not fetch separate exchange tickers');
  const canonical=panel.locator('details').filter({has:page.locator('summary').filter({hasText:'Canonical backend observations'})});
  await canonical.locator('summary').click();assert.deepEqual(JSON.parse(await canonical.locator('pre').textContent()),payload.canonical_observations);
  fs.mkdirSync(path.join(__dirname,'.runtime'),{recursive:true});await page.screenshot({path:path.join(__dirname,'.runtime/price-evidence-desktop.png')});
  await page.getByRole('tab',{name:'AI Decisions',exact:true}).click();
  const receipt=panel.locator('details').filter({has:page.locator('summary').filter({hasText:'Actual decision-time evidence'})});await receipt.locator('summary').click();assert.deepEqual(JSON.parse(await receipt.locator('pre').textContent()),input);
  await page.getByRole('tab',{name:'News & Intelligence',exact:true}).click();
  const earlier=panel.getByText('Earlier saved assessments and article evidence',{exact:true});await earlier.click();assert.match(await panel.innerText(),/NOT_ASSESSED/);
  // The old fixture asserts before asynchronous mount and never expands this legacy section.
  quote.ticker_expires_at=new Date(Date.now()-1000).toISOString();
  await page.locator('#asset-analysis-refresh').click();await page.waitForFunction(()=>document.querySelector('#asset-analysis-cards').getAttribute('aria-busy')==='false');await page.locator('.aa-card').first().click();
  await panel.getByText('103.25 USDT',{exact:true}).waitFor();assert.match(await panel.innerText(),/STALE/);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(__dirname,'.runtime/price-evidence-mobile.png')});
  assert.deepEqual(errors,[]);console.log('PASS: canonical backend price, no independent ticker requests, original timestamps/expiry, stale display, exact retained payload including zero/5m, and asynchronous news legacy inspection.');
 }finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
