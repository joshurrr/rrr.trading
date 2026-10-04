const {chromium}=require('playwright');
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
(async()=>{
 const server=http.createServer((req,res)=>{let file=path.join(__dirname,new URL(req.url,'http://local').pathname);if(req.url.split('?')[0].endsWith('/'))file=path.join(file,'index.html');fs.readFile(file,(e,d)=>{if(e)return res.writeHead(404).end();res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.png')?'image/png':'text/html');res.end(d);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));let failed=false,stale=false,published=false;
 const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Australia/Brisbane',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const macro=()=>({report_type:'macro_base',timezone:'Australia/Brisbane',report_date:stale?'2020-01-01':date(),generated_at:new Date().toISOString(),macro_score:55,macro_regime:'Mixed',confidence:80,scoring:{coverage:0.8},components:Object.fromEntries(['rates','usd','equities','liquidity','volatility','macro_events'].map(k=>[k,{score:k==='macro_events'?null:55,status:'Neutral',provenance:{observations:k==='macro_events'?[]:[{series_id:'DGS2',value:4.2,observation_date:'2026-09-30',fresh:true},{series_id:'DGS10',value:4.4,observation_date:'2026-09-29',fresh:false}]}}]))});
 await page.route('https://stream.radiorrr.com/**',r=>r.abort());
 const calls=[];
 await page.route('https://api.rrr.trading/**',r=>{const endpoint=new URL(r.request().url()).pathname;calls.push(endpoint);if(failed)return r.fulfill({status:503});let d;
 if(endpoint==='/api/market-summary')d={currency:'USD',updated_at:new Date().toISOString(),markets:['BTC','ETH','SOL','XRP'].map((symbol,i)=>({symbol,price:[80000,2500,150,0.5][i],change_24h:1,updated_at:new Date(Date.now()-(stale?180000:0)).toISOString()}))};
 else if(endpoint==='/market-regime')d={market_regime:'neutral',average_confidence:64.1};
 else if(endpoint.includes('/macro/'))d=macro();
 else {const key=endpoint.includes('/short/')?'short':endpoint.includes('/long/')?'long':'medium';d={ok:true,demo:key,generated_at:Date.now()/1000-(stale?90:0),bot:{state:'RUNNING',mode:'PAPER',timeframe:{short:'15m',medium:'1h',long:'4h'}[key],stake_currency:'USDT'},portfolio:{profit_all_abs:0,open_positions:0}};}
 return r.fulfill({json:d});});
 await page.route('**/data/daily-crypto-report.html',r=>published?r.fulfill({contentType:'text/html',body:'<div data-report-kind="published" data-report-date="2 October 2026"><section><h3>Published test briefing</h3><p>Verified report content.</p></section></div>'}):r.continue());
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/');await page.waitForFunction(()=>document.querySelector('#assessment-regime').textContent==='NEUTRAL');
 assert.equal(await page.locator('.market-tile:visible').count(),4);assert.equal(await page.locator('#market-inputs,.input-card').count(),0);assert.equal(await page.locator('.assessment-grid>div:visible').count(),1);assert.equal(await page.locator('#assessment-conviction').innerText(),'64.1 / 100');assert.equal(await page.locator('#demo-summary,[data-paper]').count(),0);assert(!calls.some(p=>p==='/status'||p.includes('/api/demos/')));
 assert(!/placeholder|manual inputs|API model/.test(await page.locator('main').innerText()));
 for(const width of [1920,1600,1440,1366,1024,768,600,390,375,320]){
 await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Home overflow '+width);
 const cols=await page.locator('.macro-components').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);assert.equal(cols,width>=1200?6:width>700?3:width>=360?2:1);
 await page.screenshot({path:path.join(os.tmpdir(),`rrr-polish-home-${width}.png`),fullPage:true});
 }
 await page.evaluate(()=>renderMarketSummary({currency:'USD',updated_at:new Date().toISOString(),markets:[{symbol:'TOTAL',price:2e12,updated_at:new Date().toISOString()}]}));assert(await page.locator('.market-tile').nth(4).isVisible());
 stale=true;await page.evaluate(async()=>{await refreshMarketSummary();await refreshMacro();});assert.equal(await page.locator('#macro-score').innerText(),'—');assert.match(await page.locator('#macro-summary').innerText(),/current 7 am Brisbane reporting cycle/);assert(await page.locator('.market-tile').nth(4).isHidden());
 failed=true;await page.evaluate(async()=>{await refreshRegime();await refreshMacro();});assert.equal(await page.locator('.input-card:visible').count(),0);assert.equal(await page.locator('.assessment-grid>div:visible').count(),0);assert.equal(await page.locator('.macro-component').count(),6);
 failed=false;stale=false;
 for(const [url,key] of [['/about.html','about'],['/reports.html','reports'],['/demo/','demo'],['/demo/short/','demo'],['/demo/4hrbot/','demo'],['/','home']]){
 await page.goto(base+url);assert.equal(await page.locator('#navigation [aria-current]').getAttribute('data-page'),key);assert.equal(await page.locator('#navigation [data-page=about]').getAttribute('href'),'/about.html');assert.equal(await page.locator('#radio-audio').evaluate(a=>a.paused&&!a.autoplay),true);
 for(const width of [1920,1440,901,768,390,320]){await page.setViewportSize({width,height:1000});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),url+' overflow '+width);}
 if(key==='about'){assert.equal(await page.locator('.market-strip,.macro-panel,.assessment-card').count(),0);await page.screenshot({path:path.join(os.tmpdir(),'rrr-polish-about-mobile.png'),fullPage:true});}
 if(key==='reports'){await page.waitForTimeout(100);assert(await page.locator('#today').isHidden());assert(!/TEMPLATE|EXAMPLE|2026-09-29/.test(await page.locator('main').innerText()));await page.screenshot({path:path.join(os.tmpdir(),'rrr-polish-reports-mobile.png'),fullPage:true});}
 }
 await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/about.html');await page.locator('#demo-toggle').focus();await page.keyboard.press('ArrowDown');assert(await page.locator('#demo-options').isVisible());await page.keyboard.press('Escape');assert(await page.locator('#demo-options').isHidden());await page.screenshot({path:path.join(os.tmpdir(),'rrr-polish-about-desktop.png'),fullPage:true});
 await page.locator('#radio-audio').evaluate(a=>a.play=()=>Promise.reject(Error('Test stream')));await page.locator('#radio-toggle').click();assert.match(await page.locator('#radio-status').innerText(),/unavailable/);
 published=true;await page.goto(base+'/reports.html');await page.waitForFunction(()=>!document.querySelector('#today').hidden);assert.match(await page.locator('#daily-report').innerText(),/Published test briefing/);assert(await page.locator('#reports-empty').isHidden());
 assert.deepEqual(errors,[]);assert(calls.every(p=>['/api/research','/api/trading-context','/api/experiments/summary','/api/shadow-decisions','/api/shadow-decisions/summary','/api/shadow-decisions/health','/score','/api/market-summary','/api/reports/macro/today','/market-regime','/status','/api/demos/short/status','/api/demos/long/status','/api/demos/long/decision-flow','/api/demos/medium/decision-flow','/api/demos/short/decision-flow'].includes(p)));
 console.log('PASS: presentation, genuine/sample report gating, exact read-only feeds, zero/missing/stale/outage/recovery, ten home widths, six-page navigation/overflow, keyboard demo control and radio opt-in/error; no page errors.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
