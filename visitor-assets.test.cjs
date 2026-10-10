const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const KEY='rrr.trading.visitor.assets.v1';
const assets='BTC ETH SOL XRP LINK ONDO AAVE UNI HYPE INJ'.split(' ').map((symbol,i)=>({rank:i+1,symbol,pair:symbol+'/USDT:USDT',opportunity_score:87-i,reason:'Saved current recommendation evidence.',trend:'positive',data_confidence:.8}));
const identities=[...assets.map(a=>a.symbol),'ADA',...Array.from({length:119},(_,i)=>'COIN'+i)].map(symbol=>({symbol,name:symbol==='BTC'?'Bitcoin':symbol==='ADA'?'Cardano':symbol,enabled:true,exchange:'bybit',market_type:'linear_perpetual',exchange_symbol:symbol+'USDT'}));
const server=http.createServer((req,res)=>{const file=path.join(__dirname,new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));fs.readFile(file,(e,b)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); const origin='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,channel:'msedge'});const errors=[],writes=[];
 let recommendations=assets,blocked=false,legacy=false,incomplete=false,unsupported=false,malformed=false;
 const universe=()=>({schema_version:1,status:'ok',universe_version:'fixture-'+recommendations[0].symbol,generated_at:new Date(Math.floor(Date.now()/60000)*60000).toISOString(),valid_until:new Date(Date.now()+600000).toISOString(),eligible_market_count:identities.length+(incomplete?1:0),excluded_pairs:[],entry_eligible:true,assets:recommendations});
 async function setup(context){await context.route('https://stream.radiorrr.com/**',r=>r.abort());await context.route('https://api.rrr.trading/**',r=>{
  if(r.request().method()!=='GET')writes.push(r.request().url());const p=new URL(r.request().url()).pathname;
  if(p==='/api/trading-universe')return r.fulfill({json:universe()});
  if(p==='/api/assets/approved')return legacy?r.fulfill({status:404}):blocked?r.fulfill({status:503}):r.fulfill({json:{schema_version:1,status:'ok',generated_at:new Date(Date.now()-1000).toISOString(),valid_until:new Date(Date.now()+600000).toISOString(),assets:malformed?[{symbol:'<script>',pair:'x'}]:identities.filter(a=>!unsupported||a.symbol!=='ADA').map(a=>({symbol:a.symbol,pair:a.symbol+'/USDT:USDT',name:a.name}))}});
  if(p==='/api/trading-universe/candidates')return r.fulfill({json:{...universe(),candidates:identities.map(a=>({symbol:a.symbol,pair:a.symbol+'/USDT:USDT'}))}});
  if(p==='/api/v2/intelligence/assets')return r.fulfill({json:{total:identities.length,assets:identities}});
  return r.fulfill({status:503});
 });}
 try{
  const a=await browser.newContext();await setup(a);const page=await a.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
  await page.waitForFunction(()=>document.querySelectorAll('#universe-assets .universe-card').length===10);
  assert.equal(await page.locator('#visitor-recommended').getAttribute('aria-pressed'),'true');
  await page.locator('#visitor-personal').click();await page.waitForFunction(()=>document.querySelectorAll('#visitor-available button').length===120);
  assert.equal(await page.locator('#visitor-selected button').count(),10);
  assert.equal(await page.locator('#visitor-personal').innerText(),'⚙ MY ASSETS');
  assert.equal(await page.locator('.visitor-customise').count(),0);
  await page.locator('#visitor-search').fill('CaRdAnO');assert.equal(await page.locator('#visitor-available button').count(),1);
  await page.getByRole('button',{name:'Add ADA · Cardano',exact:true}).click();assert.equal(await page.locator('#visitor-selected button').count(),11);assert.equal(await page.locator('#visitor-available button').count(),0);
  await page.getByRole('button',{name:'Remove BTC',exact:true}).click();assert.equal(await page.locator('#visitor-selected button').count(),10);
  await page.locator('#visitor-search').fill('bitcoin');assert.equal(await page.locator('#visitor-available button').count(),1);
  await page.getByRole('button',{name:'Add BTC · Bitcoin',exact:true}).click();
  await page.locator('#visitor-done').click();assert(await page.locator('#visitor-panel').evaluate(e=>e.hidden));assert.equal(await page.locator('#visitor-cards .universe-card').count(),11);
  assert.equal(await page.locator('#universe-assets .universe-card').count(),10);
  await page.getByRole('button',{name:'Inspect ADA asset intelligence',exact:true}).click();await page.waitForSelector('#asset-intelligence-dialog[open]');assert.match(await page.locator('#ai-title').innerText(),/ADA/);await page.keyboard.press('Escape');
  const saved=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),KEY);assert.equal(saved.assets.length,11);assert.equal(saved.mode,'personal');assert.equal(await page.locator('#visitor-personal').innerText(),'⚙ MY ASSETS (11)');
  await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#visitor-cards button:not(:disabled)').length===11);
  assert(await page.locator('#visitor-panel').evaluate(e=>e.hidden));
  await page.locator('#visitor-recommended').click();assert(await page.locator('#visitor-open').evaluate(e=>e.hidden));
  await page.locator('#visitor-personal').click();assert(await page.locator('#visitor-panel').evaluate(e=>e.hidden));
  // Independent profile has the default view and no personal browser records.
  const b=await browser.newContext();await setup(b);const other=await b.newPage();await other.goto(origin);assert.equal(await other.evaluate(k=>localStorage.getItem(k),KEY),null);assert.equal(await other.locator('#visitor-recommended').getAttribute('aria-pressed'),'true');await other.waitForFunction(()=>document.querySelectorAll('#universe-assets .universe-card').length===10);
  await other.locator('#visitor-personal').click();assert.equal(await other.evaluate(k=>localStorage.getItem(k),KEY),null);
  await other.locator('#visitor-done').click();assert.equal(await other.locator('#visitor-personal').innerText(),'⚙ MY ASSETS (10)');
  await b.close();
  const before=saved.assets;recommendations=[...assets.slice(1),{...assets[0],symbol:'ADA',pair:'ADA/USDT:USDT'}].map((a,i)=>({...a,rank:i+1}));await page.evaluate(()=>refreshTradingUniverse());assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).assets,KEY),before);
  await page.locator('#visitor-open').click();await page.locator('#visitor-reset').click();assert.deepEqual(await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).assets,KEY),recommendations.map(a=>a.symbol));
  await page.locator('#visitor-search').fill('no-such-asset');assert.match(await page.locator('#visitor-available').innerText(),/No matching/);await page.locator('#visitor-search').fill('');
  for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:900});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Overflow '+width);assert.equal(await page.locator('#visitor-cards').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),width>=1000?5:width>=700?3:width>=360?2:1);await page.locator('#visitor-panel').screenshot({path:'.runtime/visitor-assets-'+width+'.png'});}
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('#visitor-panel').evaluate(e=>getComputedStyle(e).animationName),'none');
  unsupported=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#visitor-source').textContent.includes('129 approved'));assert.match(await page.locator('#visitor-cards').innerText(),/no longer in the approved/);assert((await page.evaluate(k=>JSON.parse(localStorage.getItem(k)).assets,KEY)).includes('ADA'));unsupported=false;
  blocked=true;await page.reload();await page.locator('#visitor-open').click();await page.waitForFunction(()=>!document.querySelector('#visitor-retry').hidden);assert.equal(await page.locator('#universe-assets .universe-card').count(),10);assert.match(await page.locator('#visitor-source').innerText(),/could not be verified/);blocked=false;await page.locator('#visitor-retry').click();await page.waitForFunction(()=>document.querySelector('#visitor-source').textContent.includes('130 approved'));
  legacy=true;await page.reload();await page.waitForFunction(()=>document.querySelector('#visitor-source').textContent.includes('130 approved'));incomplete=true;await page.reload();await page.waitForFunction(()=>!document.querySelector('#visitor-retry').hidden);assert.match(await page.locator('#visitor-source').innerText(),/complete approved/);incomplete=false;legacy=false;
  malformed=true;await page.reload();await page.waitForFunction(()=>!document.querySelector('#visitor-retry').hidden);assert.equal(await page.locator('#visitor-available button').count(),0);malformed=false;
  await page.locator('#visitor-open').click();
  while(await page.locator('#visitor-selected button').count()) await page.locator('#visitor-selected button').first().click();
  await page.locator('#visitor-done').click();
  assert.equal(await page.locator('#visitor-personal').innerText(),'⚙ MY ASSETS (0)');
  await page.reload();assert(await page.locator('#visitor-panel').evaluate(e=>e.hidden));
  assert.match(await page.locator('#visitor-cards').innerText(),/watchlist is empty/);
  await page.locator('#visitor-open').click();assert.equal(await page.locator('#visitor-selected button').count(),0);
  await a.close();
  // Persistence after a browser restart using an actual disk-backed browser profile.
  const profile=path.join(__dirname,'.runtime','visitor-profile-'+Date.now());
  let persistent=await chromium.launchPersistentContext(profile,{headless:true,channel:'msedge'});await setup(persistent);let p=await persistent.newPage();await p.goto(origin);await p.evaluate(({key,saved})=>localStorage.setItem(key,JSON.stringify(saved)),{key:KEY,saved});await persistent.close();
  persistent=await chromium.launchPersistentContext(profile,{headless:true,channel:'msedge'});await setup(persistent);p=await persistent.newPage();await p.goto(origin);await p.waitForFunction(()=>document.querySelectorAll('#visitor-cards .universe-card').length===11);assert.deepEqual(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)).assets,KEY),saved.assets);await persistent.close();
  for(const disabled of [false,true]){const c=await browser.newContext();await setup(c);await c.addInitScript(({key,disabled})=>{if(disabled)Object.defineProperty(window,'localStorage',{get(){throw Error('Storage disabled')}});else localStorage.setItem(key,'{broken');},{key:KEY,disabled});const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);await p.locator('#visitor-personal').click();await p.waitForFunction(()=>document.querySelector('#visitor-source').textContent.includes('130 approved'));await p.locator('#visitor-done').click();assert.equal(await p.locator('#visitor-cards .universe-card').count(),10);if(disabled)assert.match(await p.locator('#visitor-message').innerText(),/this visit only/);await c.close();}
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);console.log('PASS visitor watchlist: full 130-asset search, local persistence/restart/profile isolation, central refresh/reset, modal, unavailable/corrupt/disabled storage, obsolete/malformed/incomplete evidence, GET-only, reduced motion and four widths.');
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
