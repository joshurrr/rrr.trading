const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;const file=path.join(__dirname,p.replace(/\/$/,'/index.html'));fs.readFile(file,(err,data)=>{if(err)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const now=new Date().toISOString();
  const row=(symbol,side,rank)=>({exchange:'bybit',symbol:symbol+'USDT',pair:symbol+'USDT/USDT:USDT',side,rank,timeframe:'1h',momentum_support:'FAVOURS',sentiment_alignment:'ALIGNED',return_pct:2.3,observed_at:now,expires_at:new Date(Date.now()+60000).toISOString(),state:'CURRENT',sol_decision_status:'NOT_REPORTED',source_timestamps:{discovery:now,ticker:now,candles:now,sentiment:now},source_freshness:{discovery:'AVAILABLE',ticker:'AVAILABLE',candles:'AVAILABLE',sentiment:'AVAILABLE'},provenance:{source:'saved_paper_cycle',source_version:'paper-cycle-v1',cycle_started_at:now}});
  const payload={version:'paper-read-api-v1',mode:'paper',served_at:now,open_positions:{availability:'AVAILABLE',items:[{symbol:'BTCUSDT',side:'LONG',availability:'AVAILABLE',entered_at:now,current_mark:100}]},completed_trades:{availability:'AVAILABLE',items:[{symbol:'ETHUSDT',side:'SHORT',realized_pnl:3.2,closed_at:now}]},overview:{shortlists:{LONG:{state:'CURRENT',observed_at:now,purpose:'RESEARCH_RANKING_ONLY',provenance:{source:'saved_paper_cycle'},items:[row('BTC','LONG',1)]},SHORT:{state:'CURRENT',observed_at:now,purpose:'RESEARCH_RANKING_ONLY',provenance:{source:'saved_paper_cycle'},items:[row('ETH','SHORT',1)]}}}};
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://assets.coincap.io/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',r=>r.fulfill({status:503,body:'unavailable'}));
  await page.route('https://v4.rrr.trading/v4/paper',r=>r.fulfill({json:payload}));
  await page.route('https://api.rrr.trading/api/v2/intelligence/assets/**',r=>{const symbol=new URL(r.request().url()).pathname.split('/').at(-1);return r.fulfill({json:{api_version:'v4-test',asset:{symbol,name:symbol,exchange:'bybit',market_type:'linear_perpetual'},timeframes:{},decision:null,market:{},news_summary:null,execution:{health:{mode:'PAPER',status:'available',stale:false,run_id:'fixture'}},overall_state:{},versions:[],learning:{}}});});
  await page.goto('http://127.0.0.1:'+server.address().port+'/asset-analysis/');
  await page.waitForSelector('#asset-analysis-cards .candidate-portrait');
  const cards=page.locator('#asset-analysis-cards .candidate-portrait');assert.equal(await cards.count(),2);
  assert.equal(await cards.nth(0).locator('.universe-rank').innerText(),'LONG #1');assert.equal(await cards.nth(1).locator('.universe-rank').innerText(),'SHORT #1');
  assert.match(await cards.nth(0).innerText(),/News ALIGNED · SOL NOT_REPORTED/);
  await cards.nth(1).locator('button').click();await page.waitForSelector('#asset-intelligence-dialog[open]');assert.match(await page.locator('#ai-title').innerText(),/ETH/);assert.match(await page.locator('#ai-panel-0').innerText(),/Shortlist/);assert.match(await page.locator('#ai-panel-0').innerText(),/NOT_RECORDED/);assert.match(await page.locator('#ai-panel-0').innerText(),/3.2 USDT/);
  await page.getByRole('button',{name:'Close asset intelligence'}).click();await page.waitForFunction(()=>!document.querySelector('#asset-intelligence-dialog').open);
  await page.locator('.intelligence-navigation button').click();const links=await page.locator('#intelligence-shortcuts a').allTextContents();assert.deepEqual(links,['Macro Market Intelligence','Macro News & Themes','Macro Economic Calendar','Asset Analysis','Asset Explorer']);
  assert.equal(await page.locator('#intelligence-shortcuts a[href="https://rrr.trading/asset-analysis/"]').getAttribute('aria-current'),'page');
  for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width);const widths=await page.evaluate(()=>({header:document.querySelector('[data-site-header] .site-header').getBoundingClientRect().width,main:document.querySelector('main.shell').getBoundingClientRect().width,footer:document.querySelector('.site-legal-footer').getBoundingClientRect().width}));assert(Math.abs(widths.header-widths.main)<1&&Math.abs(widths.main-widths.footer)<2,JSON.stringify(widths));}
  assert.deepEqual(errors,[]);console.log('PASS: shortlist-bound cards, identity-specific modal, explicit missing values, position outcome, analysis menu and five responsive widths.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
