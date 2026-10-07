const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
// All values below are browser-test fixtures, never production data.
(async () => {
 const server = http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://localhost').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:900}}), errors=[], requests=[];page.on('pageerror',e=>errors.push(e.message));
  let mode='populated', delay=0;
  const now=()=>new Date().toISOString();
  const state=(bias,confidence)=>({available:true,freshness:'fresh',bias,confidence,score:63,long_permission:'ALLOWED',short_permission:'BLOCKED',state_version:'test-v2',generated_at:now(),updated_at:now()});
  const detail=symbol=>({api_version:'2.0.0-phase1',asset:{symbol,name:symbol==='BTC'?'Bitcoin':'Ethereum',exchange:'bybit',market_type:'linear_perpetual'},overall_state:{...state('BULLISH',.72),overall_bias:'BULLISH',overall_confidence:.72,intelligence_score:75},timeframes:{'15m':state('NEUTRAL',.48),'1h':state('BULLISH',.72),'4h':state('BEARISH',.81)},news_summary:{news_bias:'BULLISH',news_score:.25,news_confidence:.6,relevant_story_count:2,recent_event_count:1,high_impact_event_count:0,recent_weighted_impact:.2,last_intelligence_update:now(),freshness:'fresh',classifier_version:'asset-news-v1'},versions:[{version:'foundation-v1',status:'FOUNDATION',description:'Schema metadata only'}]});
  const universe=()=>({schema_version:1,status:'ok',entry_eligible:true,universe_version:'test-v1',generated_at:now(),valid_until:new Date(Date.now()+600000).toISOString(),assets:'BTC ETH SOL XRP LINK ONDO AAVE UNI HYPE INJ'.split(' ').map((symbol,i)=>({symbol,pair:symbol+'/USDT:USDT',rank:i+1,opportunity_score:80-i,reason:'Test-only evidence',data_confidence:.8,trend:'positive'}))});
  await page.route('https://stream.radiorrr.com/**',r=>r.abort());
  await page.route('https://api.rrr.trading/**',async r=>{
   const p=new URL(r.request().url()).pathname;requests.push(p);
   if(p==='/api/trading-universe')return r.fulfill({json:universe()});
   if(p==='/api/market-summary')return r.fulfill({json:{currency:'USD',source:'kraken',markets:[{symbol:'BTC',price:123,updated_at:mode==='stale'?'2000-01-01':now()}]}});
   const m=/\/api\/v2\/intelligence\/assets\/([A-Z0-9]+)(?:\/(news|events))?$/.exec(p);
   if(!m)return r.fulfill({status:503});
   if(delay)await new Promise(resolve=>setTimeout(resolve,delay));
   if(mode==='failure'||mode==='missing')return r.fulfill({status:mode==='missing'?404:503});
   if(mode==='partial'&&m[2]==='news')return r.fulfill({status:503});
   const d=detail(m[1]);
   if(m[2])return r.fulfill({json:{asset:d.asset,status:mode==='empty'?'unavailable':mode==='degraded'?'degraded':'ok',[m[2]]:['populated','degraded','unknown-time'].includes(mode)?m[2]==='news'?[{headline:'Test headline <script>',source:'Fixture source',published_at:now(),confidence:.6,relevance_score:.7,impact_score:.4,direction:'BULLISH',event_type:'ETF',freshness:'fresh',classifier_version:'asset-news-v1',source_url:'https://example.test/story'}]:[{event_type:'TEST',description:'Fixture event',event_time:mode==='unknown-time'?null:now(),source:'Fixture source',importance:.4,confidence:.6,freshness:'stale',classifier_version:'asset-news-v1',source_url:'javascript:alert(1)'}]:[]}});
   if(mode==='empty'){d.overall_state={available:false,overall_bias:'UNKNOWN',overall_confidence:null};d.timeframes={};d.news_summary={news_bias:'UNKNOWN',news_score:null,news_confidence:null,relevant_story_count:0,freshness:'empty',classifier_version:'asset-news-v1'};}
   if(mode==='partial')delete d.timeframes['4h'];
   if(mode==='stale'){d.overall_state.generated_at='2000-01-01';d.timeframes['15m'].generated_at='2000-01-01';}
   return r.fulfill({json:d});
  });
  const base=`http://127.0.0.1:${server.address().port}`;await page.goto(base);await page.waitForSelector('.universe-bubble');
  const modal=page.locator('#asset-intelligence-dialog'), btc=page.locator('.universe-bubble').first(), x=page.getByRole('button',{name:'Close asset intelligence'});
  await btc.focus();await btc.press('Enter');await page.waitForSelector('#ai-news .ai-record');
  assert.match(await modal.innerText(),/BTC — Bitcoin/);assert(requests.includes('/api/v2/intelligence/assets/BTC'));assert(requests.includes('/api/v2/intelligence/assets/BTC/news'));assert(requests.includes('/api/v2/intelligence/assets/BTC/events'));
  for(const [frame,bias,confidence]of [['15m','NEUTRAL','48%'],['1h','BULLISH','72%'],['4h','BEARISH','81%']]){const text=await page.locator(`[data-timeframe="${frame}"]`).innerText();assert(text.includes(bias)&&text.includes(confidence));assert.match(text,/Long permission\s+ALLOWED/);}
  assert.match(await page.locator('#ai-price').innerText(),/\$123/);assert.match(await page.locator('#ai-news').innerText(),/Test headline <script>/);assert.equal(await page.locator('#ai-news script').count(),0);assert.match(await page.locator('#ai-news-summary').innerText(),/News score.*|−1 to \+1/);assert.match(await page.locator('#ai-news-summary').innerText(),/asset-news-v1/);assert.equal(await page.locator('#ai-news a').count(),1);assert.equal(await page.locator('#ai-events a').count(),0);assert.match(await page.locator('#ai-events').innerText(),/stale/);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');assert.equal(await x.evaluate(e=>e===document.activeElement),true);
  await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement.closest('dialog')!==null));
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:700});assert(await modal.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'modal overflow '+width);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('.ai-timeframes').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width<=700?1:3);if([375,1440].includes(width)){fs.mkdirSync('.runtime',{recursive:true});await page.screenshot({path:`.runtime/phase2-${width}.png`});}}
  await x.click();await page.waitForFunction(()=>!document.querySelector('dialog').open);assert.equal(await btc.evaluate(e=>e===document.activeElement),true);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await btc.click();await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog').open);
  await btc.click();await page.mouse.click(1,1);await page.waitForFunction(()=>!document.querySelector('dialog').open);
  for(let i=0;i<3;i++){await btc.click();await x.click();await page.waitForFunction(()=>!document.querySelector('dialog').open);}
  mode='empty';await btc.click();await page.waitForSelector('#ai-events');await page.waitForFunction(()=>document.querySelector('#ai-events').textContent.includes('No events'));assert.match(await modal.innerText(),/UNKNOWN/);assert.match(await modal.innerText(),/No asset-specific intelligence has been recorded yet/);assert.match(await modal.innerText(),/Learning history will appear/);assert.equal(await page.locator('.ai-bias[data-tone]').count(),0);await x.click();
  for(const testMode of ['degraded','unknown-time']){mode=testMode;await btc.click();await page.waitForSelector('#ai-news .ai-record');if(testMode==='degraded')assert.match(await page.locator('#ai-news').innerText(),/degraded.*source collection health/);else assert.match(await page.locator('#ai-events').innerText(),/Event time unknown; publication is separate/);await x.click();}
  mode='partial';await btc.click();await page.waitForFunction(()=>document.querySelector('#ai-news')?.textContent.includes('unavailable.'));assert.match(await page.locator('[data-timeframe="4h"]').innerText(),/UNAVAILABLE/);await x.click();
  mode='stale';await btc.click();await page.waitForFunction(()=>document.querySelector('#ai-price')?.textContent.includes('stale'));assert.match(await modal.innerText(),/STALE · saved assessment/);await x.click();
  for(const [m,text]of [['failure','Asset intelligence unavailable'],['missing','Asset not found']]){mode=m;await btc.click();await page.waitForFunction(t=>document.querySelector('.ai-content').textContent.includes(t),text);assert(await page.getByRole('button',{name:'Retry',exact:true}).isVisible());await x.click();}
  mode='populated';delay=700;await btc.click();assert.match(await modal.innerText(),/Loading asset intelligence/);await page.evaluate(()=>AssetIntelligence.open('ETH'));await page.waitForFunction(()=>document.querySelector('#ai-title').textContent==='ETH — Ethereum');await page.waitForSelector('#ai-events .ai-record');assert(!await modal.innerText().then(t=>t.includes('BTC')));delay=0;await x.click();
  // Native close events are queued: synchronous reopen must keep the new request and scroll lock.
  await btc.click();await page.evaluate(()=>{const d=document.querySelector('dialog');d.close();AssetIntelligence.open('ETH');});await page.waitForFunction(()=>document.querySelector('#ai-title').textContent==='ETH — Ethereum');await page.waitForSelector('#ai-events .ai-record');assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await x.click();assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await page.locator('.header-asset button').first().click();await page.waitForFunction(()=>document.querySelector('#ai-title').textContent==='BTC — Bitcoin');await x.click();
  await page.evaluate(()=>refreshTradingUniverse());assert.equal(await page.locator('.universe-card').count(),10);assert.equal(await page.locator('#universe-assets').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),5);
  for(const folder of ['15minbot','1hrbot','4hrbot']){await page.goto(base+'/demo/'+folder+'/');await page.waitForSelector('.header-asset button');await page.locator('.header-asset button').first().click();await page.waitForFunction(()=>document.querySelector('#ai-title').textContent==='BTC — Bitcoin');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog').open);
   await page.evaluate(()=>{const article=document.createElement('article');article.className='asset-path';article.dataset.pair='ETH/USDT:USDT';article.innerHTML='<h4>ETH/USDT</h4>';document.querySelector('main').append(article);});await page.locator('.asset-path button').last().click();await page.waitForFunction(()=>document.querySelector('#ai-title').textContent==='ETH — Ethereum');await page.getByRole('button',{name:'Close asset intelligence'}).click();
  }
  assert.deepEqual(errors,[]);console.log('PASS: Phase 2 symbols/endpoints, independent timeframes, news/events, empty/partial/stale/404/503/loading, safe text, price freshness, X/Escape/backdrop, focus/scroll restoration, repeated opens, race cancellation, Top-10 refresh/5 columns, bot integration, 320/375/768/1440 layouts.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
