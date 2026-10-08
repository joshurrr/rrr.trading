const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(file.endsWith(path.sep))file+='index.html';fs.readFile(file,(e,data)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(data);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));
 let key,tf,scenario;
 const map={short:['15minbot','15m','15 min Bot','Short Term 15m',7],medium:['1hrbot','1h','1 hr Bot','Medium 1hr',3],long:['4hrbot','4h','4 hr Bot','Long Term 4hr',9]};
 const start=()=>new Date(Date.now()-19*3600000-34*60000).toISOString();
 await page.route('https://api.rrr.trading/**',async r=>{
  requests.push(r.request().method());const url=r.request().url();
  if(scenario==='loading')await new Promise(resolve=>setTimeout(resolve,750));
  if(url.endsWith('/reporting')){assert(url.includes('/'+key+'/reporting'));if(scenario==='report-fail')return r.fulfill({status:503,json:{}});return r.fulfill({json:{available:true,run_id:'v2-test<script>',started_at:start(),observed_at:new Date(Date.now()-(scenario==='report-stale'?60000:0)).toISOString(),portfolio:{starting_balance:10000,winning_trades:scenario==='zero'?0:scenario==='positive'?2:1,losing_trades:scenario==='zero'?0:scenario==='positive'?1:2,closed_trades:scenario==='zero'?0:3,profit_all_abs:scenario==='partial'?null:scenario==='positive'?12:scenario==='zero'?0:-14.37,profit_all_pct:scenario==='partial'?null:scenario==='positive'?.12:scenario==='zero'?0:-.1437,max_drawdown:scenario==='partial'?null:.0014},history:[],open_trades:[]}});}
  if(url.endsWith('/status')||url.endsWith('/api/status')){if(scenario==='status-fail')return r.fulfill({status:503,json:{}});return r.fulfill({json:{ok:true,demo:key,generated_at:Date.now()/1000-(scenario==='status-stale'?60:0),bot:{state:'RUNNING',mode:'PAPER',timeframe:scenario==='wrong-tf'?'2h':tf,strategy:map[key][3],exchange:'bybit',stake_currency:'USDT',trading_mode:'futures',margin_mode:'isolated',short_allowed:true,entry_owner:'paper-execution-v1',started_at:1,max_open_trades:scenario==='partial'?null:map[key][4],stake_amount:scenario==='partial'?null:'1000',pairs:[]},open_trades:[],history:[]}});}
  if(url.includes('/execution/health'))return r.fulfill({json:{mode:'PAPER',status:'available',enabled:true,stale:false,run_id:'v2-test<script>',started_at:start()}});
  if(url.includes('/execution/records'))return r.fulfill({json:{run_id:'v2-test<script>',records:[]}});
  return r.fulfill({status:503,json:{}});
 });
 for(key of Object.keys(map)) {tf=map[key][1];
  for(scenario of ['negative','positive','zero','partial','report-fail','report-stale','status-fail','status-stale','wrong-tf']){
   await page.goto(`http://127.0.0.1:${server.address().port}/demo/${map[key][0]}/`);
   await page.waitForFunction(()=>document.querySelector('#what-happening-now')&&document.querySelector('#performance-status')&&!document.querySelector('#performance-status').textContent.includes('Loading'));
   if(!['status-fail','status-stale','wrong-tf'].includes(scenario))await page.waitForFunction(()=>document.querySelector('#maxOpen').textContent!=='Loading…');
   else await page.waitForFunction(()=>/Unavailable|Stale/.test(document.querySelector('.bot-summary-status').textContent));
   assert.equal(await page.locator('#bot-summary h1').innerText(),map[key][2]);
   assert.equal(await page.locator('#bot-summary #settings .card').count(),5);assert.equal(await page.locator('#bot-summary #performance .card').count(),5);
   assert(await page.locator('#bot-summary').isVisible());assert(!await page.locator('#bot-summary').evaluate(e=>Boolean(e.closest('details'))));
   assert(await page.locator('#bot-summary').evaluate(e=>e.parentElement.tagName==='MAIN'&&e.nextElementSibling.id==='what-happening-now'));
   assert.equal(await page.locator('#bot-summary script').count(),0);
   if(!['status-fail','status-stale','wrong-tf','partial'].includes(scenario)){assert.equal(await page.locator('#maxOpen').innerText(),String(map[key][4]));assert.equal(await page.locator('#maxTrade').innerText(),'1,000.00 USDT');assert((await page.locator('#runtime').innerText()).includes('19h 34m'));assert((await page.locator('#run-start').innerText()).includes('Brisbane'));assert((await page.locator('.bot-summary-status').innerText()).includes('Running'));}
   if(['report-fail','report-stale'].includes(scenario))for(const id of ['starting','profit','profitPct','drawdown','completed','winRate'])assert.equal(await page.locator('#'+id).innerText(),'Unavailable');
   else {assert.equal(await page.locator('#winRate').innerText(),scenario==='zero'?'0 wins · 0 losses':scenario==='positive'?'2 wins · 1 loss':'1 win · 2 losses');assert.equal(await page.locator('#completed').innerText(),scenario==='zero'?'0':'3');}
   if(scenario==='negative')assert(await page.locator('#profit').evaluate(e=>e.classList.contains('bad')));
   if(scenario==='positive')assert(await page.locator('#profit').evaluate(e=>e.classList.contains('good')));
   if(scenario==='zero')assert.equal(await page.locator('#profit').getAttribute('class'),'v ');
   if(scenario==='partial'){for(const id of ['maxOpen','maxTrade','profit','profitPct','drawdown'])assert.equal(await page.locator('#'+id).innerText(),'Unavailable');}
   for(const width of [320,375,768,1440]){await page.setViewportSize({width,height:1000});assert(await page.locator('#bot-summary').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert(await page.locator('#settings').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert(await page.locator('#performance').evaluate(e=>e.scrollWidth<=e.clientWidth+1));if(width===1440){assert.equal(await page.locator('#settings').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),5);assert.equal(await page.locator('#performance').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),5);assert(await page.locator('#settings .card').first().evaluate(e=>e.getBoundingClientRect().height<110));}}
   if(scenario==='negative')for(const width of [375,1440]){await page.setViewportSize({width,height:1000});await page.screenshot({path:`.runtime/bot-summary-${key}-${width}.png`,fullPage:false});}
   await page.locator('#bot-operational-details > summary').click();assert(await page.locator('#v2-paper').isVisible());assert(await page.locator('#exit-panel').isVisible());assert(await page.locator('.completed-trades-section').isVisible());
  }
 }
 scenario='loading';key='short';tf='15m';await page.goto(`http://127.0.0.1:${server.address().port}/demo/15minbot/`);assert.equal(await page.locator('#maxOpen').innerText(),'Loading…');assert.equal(await page.locator('#profit').innerText(),'Loading…');await page.waitForFunction(()=>document.querySelector('#profit').textContent==='-14.37 USDT');
 // Expiry without a failed network request must clear the running claim.
 scenario='negative';key='short';tf='15m';await page.goto(`http://127.0.0.1:${server.address().port}/demo/15minbot/`);await page.waitForFunction(()=>document.querySelector('.bot-summary-status')?.textContent.includes('Running'));
 await page.evaluate(()=>{const original=Date.now;Date.now=()=>original()+61000;BotSummary.refresh();});assert((await page.locator('.bot-summary-status').innerText()).includes('Stale'));assert.equal(await page.locator('#profit').innerText(),'Unavailable');
 assert.deepEqual(errors,[]);assert(requests.every(x=>x==='GET'));console.log('PASS shared summaries: all bots, owning routes, dynamic max positions/current-run start, signs/grammar/zero/partial/outage/stale/expiry/wrong timeframe, 320/375/768/1440, preserved activity/details and GET-only');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1});
